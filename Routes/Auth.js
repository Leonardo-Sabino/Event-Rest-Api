const express = require("express");
require("dotenv").config();
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const bodyParser = require("body-parser");
const pool = require("../pool");
const jwt = require("jsonwebtoken");
const isValidEmail = require("../utiliz/emailValidation");
const authenticationToken = require("../middelware");
const { genderOptions, genderImages } = require("../utiliz/gender");
const bcrypt = require("bcrypt");
const { hashPassword, comparePassword } = require("../utiliz/passEncryption");

// Middlewares
router.use(bodyParser.json());

router.post("/signup", async (req, res) => {
  let newUser = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    gender: req.body.gender,
  };

  if (!newUser.username || !newUser.email || !newUser.password) {
    return res.status(400).json({
      error: "username, email and password are required",
    });
  }

  if (newUser.email && !isValidEmail(newUser.email)) {
    return res.status(400).json({
      error_message: "This email is not valid, eg: name@gmail.com",
    });
  }
  if (!newUser.gender) {
    newUser.gender = "other";
  } else if (
    newUser.gender &&
    !genderOptions.includes(newUser.gender.toLowerCase())
  ) {
    return res.status(400).json({
      error_message: `'${newUser.gender}' is not valid, eg: 'male' or 'female' or 'other`,
    });
  } else {
    newUser.gender = newUser.gender.toLowerCase();
  }

  try {
    const client = await pool.connect();

    // // set user default image based on the gender picked
    const userimage =
      genderImages[newUser.gender] ||
      "https://img.freepik.com/free-icon/user_318-563642.jpg?w=360";

    // Checks if the user already exists in the database
    const userExists = await client.query(
      "SELECT * FROM users WHERE username = $1",
      [newUser.username]
    );

    if (userExists.rows.length > 0) {
      // if username already exists
      client.release();
      return res
        .status(400)
        .json({ error_message: "This username is already in use" });
    }

    // Generate a random id for the new user using uuid
    const id = uuidv4();

    //to get the token from jwt
    const token = jwt.sign(newUser, process.env.ACCESS_TOKEN_SECRET);

    const hashedPassword = await hashPassword(newUser.password);

    // Insert the new user into the database with the generated token
    await client.query(
      "INSERT INTO users (id,username,email,password,gender,userimage,token) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        newUser.username,
        newUser.email,
        hashedPassword,
        newUser.gender,
        userimage,
        token,
      ]
    );

    // Emit the "newUser" event to notify all connected clients about the new user(websocketServer is a global variable)
    websocketServer.emit("newUser", { id, ...newUser, token });

    client.release();

    // Returns the token
    res.json({ token });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/signin", authenticationToken, async (req, res) => {
  const { username, password: receivedPassword } = req.body;

  if (!username || !receivedPassword) {
    return res
      .status(400)
      .json({ error: "username and password are required" });
  }

  try {
    const client = await pool.connect();
    const user = await client.query(`SELECT * FROM users WHERE username=$1`, [
      username,
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: `${username} not found` });
    }

    const userdbpassword = user.rows[0].password;

    const match = await comparePassword(receivedPassword, userdbpassword);

    //to remove sensitive info from the response
    const sanitizedUser = {
      id: user.rows[0].id,
      username: user.rows[0].username,
      email: user.rows[0].email,
      userimage: user.rows[0].userimage,
      gender: user.rows[0].gender,
      tokendevice: user.rows[0].tokendevice,
    };

    if (match) {
      res.status(200).json(sanitizedUser);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    if (error.message.includes("id")) {
      return res
        .status(400)
        .json({ error: "id is not valid, it should be a uuid" });
    } else {
      return res.status(error.code || 500).json({ error: error.message });
    }
  }
});

module.exports = router;
