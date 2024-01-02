const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const { Expo } = require("expo-server-sdk");
const json = require("body-parser/lib/types/json");
const pool = require("../db/pool");

// Middlewares
router.use(bodyParser.json());

router.get("/followers&followings", async (req, res) => {
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

router.post("/following/:id", async (req, res) => {
  const userId = req.params.id;
  const followingId = req.body.followingId;

  const client = await pool.connect();
  try {
    // Check if the user is already following the specified user
    const existingFollower = await client.query(
      "SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2",
      [userId, followingId]
    );

    if (existingFollower.rows.length !== 0) {
      return res
        .status(409)
        .json({ message: "You are already following this user" });
    }

    // Insert the new follower relationship
    await client.query(
      "INSERT INTO followers (id, follower_id, following_id, created_at) VALUES ($1, $2, $3, $4)",
      [uuidv4(), userId, followingId, new Date()]
    );

    res
      .status(201)
      .json({ success_message: "You are now following this user" });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ error: "An error occurred on the server" });
  } finally {
    client.release();
  }
});

const removeFollowerOrFollowing = async (req, res, type) => {
  const userId = req.params.id;
  const choise = req.body.choise;
  const otherUserId =
    type === "followers" ? req.body.followerId : req.body.followingId;

  const client = await pool.connect();
  try {
    // Check if the relationship exists in either direction (follower or following)
    const existingRelationship = await client.query(
      "SELECT * FROM followers WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)",
      [userId, otherUserId]
    );

    if (existingRelationship.rows.length === 0) {
      return res.status(400).json({
        message: `${
          type === "followers" ? "Follower" : "Following"
        } does not exist!`,
      });
    }
    //if user choose "yes", it removes the relationship in both directions
    if (choise === "yes") {
      await client.query(
        "DELETE FROM followers WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)",
        [userId, otherUserId]
      );
    } else {
      //If type is "followers," it deletes the relationship where otherUserId is following otherwise it deletes the relationship in the opposite direction.
      if (type === "followers") {
        await client.query(
          "DELETE FROM followers WHERE (follower_id = $1 AND following_id = $2)",
          [otherUserId, userId]
        );
      } else {
        await client.query(
          "DELETE FROM followers WHERE (follower_id = $1 AND following_id = $2)",
          [userId, otherUserId]
        );
      }
    }

    res.status(204).end(); // HTTP 204 for success without response body
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ error: "An error occurred on the server" });
  } finally {
    client.release();
  }
};

router.delete("/following/:id", async (req, res) => {
  await removeFollowerOrFollowing(req, res, "following");
});

router.delete("/followers/:id", async (req, res) => {
  await removeFollowerOrFollowing(req, res, "followers");
});

module.exports = router;
