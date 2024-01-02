const express = require("express");
require("dotenv").config();
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const bodyParser = require("body-parser");
const pool = require("../db/pool");
const jwt = require("jsonwebtoken");
const isValidEmail = require("../utiliz/emailValidation");
const authenticationToken = require("../middelware");
const { genderOptions, genderImages } = require("../utiliz/gender");
const { hashPassword, comparePassword } = require("../utiliz/passEncryption");
const ROLES_LIST = require("../config/roles_list");

// Middlewares
router.use(bodyParser.json());

router.post("/signup", async (req, res) => {
  let newUser = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    gender: req.body.gender,
  };

  const client = await pool.connect();

  if (
    !newUser.username ||
    !newUser.email ||
    !newUser.password ||
    !newUser.gender
  ) {
    return res.status(400).json({
      error: "username, email, password and gender are required",
    });
  }

  if (newUser.email && !isValidEmail(newUser.email)) {
    return res.status(400).json({
      error_message: "This email is not valid, eg: name@gmail.com",
    });
  }
  if (newUser.gender && !genderOptions.includes(newUser.gender.toLowerCase())) {
    return res.status(400).json({
      error_message: `${newUser.gender} is not valid, e.g. 'male' or 'female' or 'other`,
    });
  } else {
    newUser.gender = newUser.gender.toLowerCase();
  }

  try {
    // set user default image based on the gender picked
    const userimage = genderImages[newUser.gender];

    // Checks if the user already exists in the database
    const userName = await client.query(
      "SELECT * FROM users WHERE username = $1",
      [newUser.username]
    );

    const emailExists = await client.query(
      `SELECT * FROM users WHERE email = $1`,
      [newUser.email]
    );

    // if username already exists
    if (userName.rows.length > 0) {
      return res.status(400).json({ error: "This username is already in use" });
    }

    if (emailExists.rows.length > 0) {
      return res.status(400).json({
        error: "This email is already in use",
      });
    }

    // Generate a random id for the new user using uuid
    const id = uuidv4();

    //to get the token from jwt
    const role = ROLES_LIST.User;

    const token = jwt.sign({ id, role }, process.env.ACCESS_TOKEN_SECRET);

    const hashedPassword = await hashPassword(newUser.password);

    // Insert the new user into the database with the generated token
    await client.query(
      "INSERT INTO users (id,username,email,password,gender,userimage,token,role_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        id,
        newUser.username,
        newUser.email,
        hashedPassword,
        newUser.gender,
        userimage,
        token,
        role,
      ]
    );

    // Emit the "newUser" event to notify all connected clients about the new user(websocketServer is a global variable)
    websocketServer.emit("newUser", {
      id,
      ...newUser,
      userimage,
      role,
      token,
    });

    // Returns the token
    res.json({ token });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

router.get("/signin", authenticationToken, async (req, res) => {
  const { username, password: receivedPassword } = req.body;

  if (!username || !receivedPassword) {
    return res
      .status(400)
      .json({ error: "username and password are required" });
  }

  if (typeof username !== "string") {
    return res.status(400).json({ error: "username should be a string" });
  }

  try {
    const client = await pool.connect();
    const user = await client.query(`SELECT * FROM users WHERE username = $1`, [
      username,
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "This username does not exist" });
    }

    const userdbpassword = user.rows[0].password;
    const match = await comparePassword(receivedPassword, userdbpassword);

    if (match) {
      const userData = user.rows[0];

      // Sanitize sensitive data
      const sanitizedUser = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        gender: userData.gender,
        image: userData.userimage,
      };

      return res.status(200).json(sanitizedUser);
    } else {
      return res.status(401).json({ error: "Invalid password" });
    }
  } catch (error) {
    if (error.message.includes("id")) {
      return res
        .status(400)
        .json({ error: "ID is not valid, it should be a UUID" });
    } else {
      return res.status(error.code || 500).json({ error: "An error occurred" });
    }
  }
});

module.exports = router;
