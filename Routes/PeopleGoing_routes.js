const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const { Expo } = require("expo-server-sdk");
const pool = require("../db/pool");

// Middlewares
router.use(bodyParser.json());

router.get("/going", async (req, res) => {
  const client = await pool.connect();

  try {
    const result = await client.query("SELECT * FROM going");

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No one is going to the events." });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
});

router.get("/event/:id/peopleGoing", async (req, res) => {
  const eventId = req.params.id;

  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT * FROM going WHERE event_id = $1",
      [eventId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No one is going to this event!" });
    }

    return res
      .status(200)
      .json({ info: result.rows, numberOfPeopleGoing: result.rows.length });
  } catch (error) {
    console.log(error);
    if (error.message.includes("invalid input syntax for type uuid:")) {
      return res
        .status(400)
        .json({ message: "Id of the event has to be type uuid" });
    }
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
});

router.post("/going/:id", async (req, res) => {
  const eventId = req.params.id;
  const userId = req.body.id;

  const client = await pool.connect();

  try {
    const userGoing = await client.query(
      "SELECT * FROM going WHERE user_id = $1 AND event_id = $2",
      [userId, eventId]
    );

    if (userGoing.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "User already going to the event!" });
    } else {
      await client.query(
        "INSERT INTO going (id, user_id, event_id) VALUES ($1, $2, $3)",
        [uuidv4(), userId, eventId]
      );
      return res
        .status(201)
        .json({ success_message: "User is now going to the event!" });
    }
  } catch (error) {
    console.log("Error adding people going to the event:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
});

router.delete("/going/:id", async (req, res) => {
  const eventId = req.params.id;
  const userId = req.body.id;

  const client = await pool.connect();

  try {
    const userGoing = await client.query(
      "SELECT * FROM going WHERE user_id = $1 AND event_id = $2",
      [userId, eventId]
    );

    if (userGoing.rows.length <= 0) {
      return res
        .status(404)
        .json({ message: "User not found in the event's going list" });
    } else {
      await client.query(
        "DELETE FROM going WHERE user_id = $1 AND event_id = $2",
        [userId, eventId]
      );
      return res.status(200).json({
        success_message: "User is removed from the event's going list!",
      });
    }
  } catch (error) {
    console.log("Error removing people from going to the event:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
});

module.exports = router;
