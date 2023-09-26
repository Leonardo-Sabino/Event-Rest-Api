const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const { Expo } = require("expo-server-sdk");
const json = require("body-parser/lib/types/json");

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

router.get("/followers", async (req, res) => {
  const client = await pool.connect();

  try {
    const followers = await client.query("SELECT * FROM followers");

    if (followers.rows.length === 0) {
      return res.status(404).json({ error: "Followers not found!" });
    }

    res.status(200).json({
      success_message: "All followers fetched with sucess!",
      followers: followers.rows,
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ error: "An error occurred on the server" });
  } finally {
    client.release();
  }
});

router.post("/followers/:id", async (req, res) => {
  const followerId = req.params.id;
  const followingId = req.body.followingId;

  const client = await pool.connect();
  try {
    // Check if the user is already following the specified user
    const existingFollower = await client.query(
      "SELECT * FROM followers WHERE user_id = $1 AND following_id = $2",
      [followerId, followingId]
    );

    if (existingFollower.rows.length !== 0) {
      return res
        .status(400)
        .json({ message: "You are already following this user" });
    }

    // Insert the new follower relationship
    await client.query(
      "INSERT INTO followers (id, user_id, following_id, created_at) VALUES ($1, $2, $3, $4)",
      [uuidv4(), followerId, followingId, new Date()]
    );

    res.status(201).json({ success_message: "Following this user" });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ error: "An error occurred on the server" });
  } finally {
    client.release();
  }
});

router.delete("/followers/:id", async (req, res) => {
  const followerId = req.params.id;
  const followingId = req.body.followingId;

  const client = await pool.connect();
  try {
    // Check if the user is already following the specified user
    const existingFollower = await client.query(
      "SELECT * FROM followers WHERE user_id = $1 AND following_id = $2",
      [followerId, followingId]
    );

    if (existingFollower.rows.length === 0) {
      return res.status(400).json({ message: "Follower does not exist!" });
    }

    // Remove follower from db
    await client.query(
      "DELETE FROM followers WHERE user_id = $1 AND following_id = $2",
      [followerId, followingId]
    );

    res.status(201).json({ success_message: "Follower removed!" });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ error: "An error occurred on the server" });
  } finally {
    client.release();
  }
});

module.exports = router;
