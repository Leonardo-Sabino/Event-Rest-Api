const express = require("express");
require("dotenv").config();
const router = express.Router();
const bodyParser = require("body-parser");
const pool = require("../db/pool");
const authenticationToken = require("../middelware");
const isValidEmail = require("../utiliz/emailValidation");
const { hashPassword } = require("../utiliz/passEncryption");

// Middlewares
router.use(bodyParser.json());

//get all users
router.get("/users", authenticationToken, async (req, res) => {
  const { page = 1, limit = 10, name } = req.query;

  try {
    const offset = (page - 1) * limit;
    const query = `SELECT * FROM users ORDER BY id OFFSET $1 LIMIT $2`;
    const result = await pool.query(query, [offset, limit]);
    const sanitizedUsers = result.rows.map(
      ({ id, username, email, gender }) => ({
        id,
        username,
        email,
        gender,
        // userimage: user.userimage,
      })
    );

    let filteredUsers = name
      ? result.rows
          .filter(({ username }) =>
            username.toLowerCase().includes(name.toLowerCase())
          )
          .map(({ id, username, email, gender }) => ({
            id,
            username,
            email,
            gender,
            // userimage: user.userimage,
          }))
      : sanitizedUsers;

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving users." });
  }
});

//put method to update the user info
router.put("/users/me", authenticationToken, async (req, res) => {
  let userId = req.user.id;
  const updatedUser = req.body;

  const client = await pool.connect();

  if (updatedUser.username && typeof updatedUser.username !== "string") {
    return res.status(400).json({ error: "username should be a string" });
  }
  if (updatedUser.email && typeof updatedUser.email !== "string") {
    return res.status(400).json({ error: "email should be a string" });
  }

  try {
    const existingUserData = await client.query(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );

    if (!existingUserData.rows[0]) {
      return res.status(404).json({ error: "User not found!" });
    }

    if (!updatedUser.username) {
      updatedUser.username = existingUserData.rows[0].username;
    }
    if (!updatedUser.email) {
      updatedUser.email = existingUserData.rows[0].email;
    } else if (updatedUser.email && !isValidEmail(updatedUser.email)) {
      return res.status(400).json({
        error_message: "Invalid email, e.g. name@gmail.com",
      });
    }
    if (!updatedUser.password) {
      updatedUser.password = existingUserData.rows[0].password;
    } else {
      updatedUser.password = await hashPassword(updatedUser.password);
    }
    if (!updatedUser.userimage) {
      updatedUser.userimage = existingUserData.rows[0].userimage;
    }

    const result = await client.query(
      "UPDATE users SET username = $2, email = $3, password = $4, userimage = $5 WHERE id = $1",
      [
        userId,
        updatedUser.username,
        updatedUser.email,
        updatedUser.password,
        updatedUser.userimage,
      ]
    );
    if (result.rowCount === 1) {
      res.json({ message: "User successfully updated!" });
      websocketServer.emit("userUpdate", { userId, ...updatedUser }); // Emit the "userUpdate" event to notify all connected clients about the new user
    } else {
      res.status(404).json({ message: "User not found!" });
    }
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal error occurred!" });
  } finally {
    client.release();
  }
});

// delete user id based on the user's id
router.delete("/users/me", authenticationToken, async (req, res) => {
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    const deleteResponse = await client.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (deleteResponse.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await client.query("DELETE FROM users WHERE id = $1", [userId]);

    res.status(200).json({ message: "User successfully deleted!" });
  } catch (error) {
    console.log("Internal error occured:", error);
    res.status(500).json({ error: "internal server error" });
  } finally {
    client.release();
  }
});

//get token from user's device for the notification
router.post("/tokenDevice/me", async (req, res) => {
  const tokenId = req.body.tokenId;
  const userId = req.user.id;

  try {
    const client = await pool.connect();

    const userExists = await client.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);

    if (userExists.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: "User not found" });
    }

    await client.query("UPDATE users SET tokendevice = $1 WHERE id = $2", [
      tokenId,
      userId,
    ]);

    client.release();

    res.status(200).json({ message: "Token successfully updated" });
  } catch (error) {
    console.error("Error updating device token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
