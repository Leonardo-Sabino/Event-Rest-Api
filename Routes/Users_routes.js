const express = require("express");
require("dotenv").config();
const router = express.Router();
const bodyParser = require("body-parser");
const pool = require("../pool");
const authenticationToken = require("../middelware");
const isValidEmail = require("../utiliz/emailValidation");

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
router.put("/users/:id", authenticationToken, async (req, res) => {
  let userId = req.params.id;
  const updatedUser = req.body;

  if (!updatedUser.username || !updatedUser.email || !updatedUser.password) {
    return res.status(400).json({
      error_message: "Username, email and password are required fields.",
    });
  }

  if (updatedUser.email && !isValidEmail(updatedUser.email)) {
    return res.status(400).json({
      error_message: "This email is not valid, eg: name@gmail.com",
    });
  }

  try {
    const client = await pool.connect();
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
      res.json({ message: "User updated successfully!" });
      websocketServer.emit("userUpdate", { userId, ...updatedUser }); // Emit the "userUpdate" event to notify all connected clients about the new user
    } else {
      res.status(404).json({ message: "User not found!" });
    }
    client.release();
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal error occurred!" });
  }
});

// delete user id based on the user's id
router.delete("/users/:id", authenticationToken, async (req, res) => {
  const userId = req.params.id;

  try {
    const client = await pool.connect();

    const deleteResponse = await client.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    //verifying if the user exist's
    if (deleteResponse.rows.length === 0) {
      client.release();
      return res
        .status(404)
        .json({ error: "Ocorreu um erro exluindo a sua conta!" });
    }

    await client.query("DELETE FROM users WHERE id = $1", [userId]);

    res.status(200).json({ message: "Conta eliminada com sucesso!" });

    client.release();
  } catch (error) {
    console.log("Internal error occured:", error);
    res.status(500).json({ error: "internal server error" });
  }
});

//get token from user's device for the notification
router.post("/tokenDevice/:userId", async (req, res) => {
  const tokenId = req.body.tokenId;
  const userId = req.params.userId;

  try {
    const client = await pool.connect();

    // Verifica se o usuário existe antes de atualizar o token
    const userExists = await client.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);

    if (userExists.rows.length === 0) {
      // Usuário não encontrado
      client.release();
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Atualiza o tokenDevice do usuário com o novo valor do token
    await client.query("UPDATE users SET tokendevice = $1 WHERE id = $2", [
      tokenId,
      userId,
    ]);

    client.release();

    // Retorna a resposta com o token atualizado (opcional)
    res.status(200).json({ message: "Token atualizado com sucesso" });
  } catch (error) {
    console.error("Error updating device token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
