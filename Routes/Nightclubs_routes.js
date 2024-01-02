const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const pool = require("../db/pool");

// Middlewares
router.use(bodyParser.json());

// Route to get all nigthClubs
router.get("/nightclubs", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM nightclubs");
    const nightclub = result.rows;
    client.release();
    res.json(nightclub);
  } catch (error) {
    console.error("Error fetching nightclub:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get a single event by ID
router.get("/nightclubs/:id", async (req, res) => {
  const nightclubId = req.params.id;
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT * FROM nightclubs WHERE id = $1",
      [nightclubId]
    );
    const nightclub = result.rows[0];
    client.release();
    if (nightclub) {
      res.json(nightclub);
    } else {
      res.status(404).json({ error: "Nightclub not found" });
    }
  } catch (error) {
    console.error("Error fetching nightclub:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to add a new nightclub
router.post("/nightclubs", async (req, res) => {
  const newNightclub = {
    id: uuidv4(),
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    name: req.body.name,
    description: req.body.description,
    image: req.body.image,
    rating: req.body.rating,
    reviews: req.body.reviews,
  };

  try {
    const client = await pool.connect();
    await client.query(
      "INSERT INTO nightclubs (id, latitude, longitude, name, description, image, rating, reviews) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        newNightclub.id,
        newNightclub.latitude,
        newNightclub.longitude,
        newNightclub.name,
        newNightclub.description,
        newNightclub.image,
        newNightclub.rating,
        newNightclub.reviews,
      ]
    );

    client.release();

    res.json({
      message: "Nightclub added successfully!",
      nightclub: newNightclub,
    });
  } catch (error) {
    console.error("Error adding nightclub:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
