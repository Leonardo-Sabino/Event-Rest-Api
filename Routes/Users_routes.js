const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");

// Create a new PostgreSQL pool
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "eventdb",
  password: "19991703",
  port: 5432, // Default PostgreSQL port
});

// Middlewares
router.use(bodyParser.json());

//get all users
router.get("/users", async (req, res) => {
  try {
    const query = "SELECT * FROM users";
    const result = await pool.query(query);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving users." });
  }
});

// images based on the gender selected
const genderImages = {
  masculino:
    "https://www.shareicon.net/data/512x512/2016/05/24/770117_people_512x512.png",
  feminino:
    "https://w7.pngwing.com/pngs/129/292/png-transparent-female-avatar-girl-face-woman-user-flat-classy-users-icon.png",
  outro: "https://img.freepik.com/free-icon/user_318-563642.jpg?w=360",
};

//post method
router.post("/signup", async (req, res) => {
  const newUser = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    gender: req.body.gender,
  };

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
        .json({ error_message: "Esse nome de usuário já está em uso." });
    }

    // Generate a random token and id for the new user using uuid
    const [token, id] = [uuidv4(), uuidv4()];

    // Insert the new user into the database with the generated token
    await client.query(
      "INSERT INTO users (id,username,email,password,gender,userimage,token) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        newUser.username,
        newUser.email,
        newUser.password,
        newUser.gender,
        userimage,
        token,
      ]
    );

    // Emit the "userUpdate" event to notify all connected clients about the new user
    websocketServer.emit("userUpdate", { id, ...newUser, token });

    client.release();

    // Return the token along with the user information
    res.json({
      message: "User added successfully!",
      user: { ...newUser, token },
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//put method to update the user info
router.put("/users/:userId", async (req, res) => {
  let userId = req.params.userId;
  const updatedUser = req.body;

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
router.delete("/users/:userId", async (req, res) => {
  const userId = req.params.userId;

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
