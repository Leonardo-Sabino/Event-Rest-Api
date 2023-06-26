const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const cron = require("node-cron");
const app = express();
const port = 3000;

app.use(bodyParser.json());

// Create a new PostgreSQL pool
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "eventdb",
  password: "19991703",
  port: 5432, // Default PostgreSQL port
});

// Route to get all events
app.get("/events", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM events");
    const events = result.rows;
    client.release();
    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get a single event by ID
app.get("/events/:id", async (req, res) => {
  const eventId = req.params.id;
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM events WHERE id = $1", [
      eventId,
    ]);
    const event = result.rows[0];
    client.release();
    if (event) {
      res.json(event);
    } else {
      res.status(404).json({ error: "Event not found" });
    }
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to update an event by ID
app.put("/events/:id", async (req, res) => {
  const eventId = req.params.id;
  const updatedEvent = req.body;

  try {
    const client = await pool.connect();
    const result = await client.query(
      "UPDATE events SET longitude = $2, latitude = $3, eventname = $4, eventdescription = $5, eventphotograph = $6, starttime = $7, endtime = $8, eventdate = $9, rating = 10$, reviews = 11$, price = 12$ WHERE id = $1",
      [
        eventId,
        updatedEvent.longitude,
        updatedEvent.latitude,
        updatedEvent.eventname,
        updatedEvent.eventdescription,
        updatedEvent.eventphotograph,
        updatedEvent.starttime,
        updatedEvent.endtime,
        updatedEvent.eventdate,
        updatedEvent.rating,
        updatedEvent.reviews,
        updatedEvent.price,
      ]
    );

    if (result.rowCount === 1) {
      res.json({ message: "Event updated successfully!" });
    } else {
      res.status(404).json({ error: "Event not found" });
    }

    client.release();
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//to update the state of the event
app.put("/events/:id/state", async (req, res) => {
  const eventId = req.params.id;
  const newState = req.body.state;

  try {
    const client = await pool.connect();

    // Check if the event exists
    const existingEvent = await client.query(
      "SELECT * FROM events WHERE id = $1",
      [eventId]
    );

    if (existingEvent.rows.length === 0) {
      // Event not found
      res.status(404).json({ error: "Event not found" });
    } else {
      // Update the state of the event
      await client.query("UPDATE events SET state = $1 WHERE id = $2", [
        newState,
        eventId,
      ]);

      client.release();

      res.json({
        message: "Event state updated successfully!",
        eventId,
        newState,
      });
    }
  } catch (error) {
    console.error("Error updating event state:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to add a new event
app.post("/events", async (req, res) => {
  const newEvent = {
    id: uuidv4(),
    longitude: req.body.longitude,
    latitude: req.body.latitude,
    eventname: req.body.eventname,
    eventdescription: req.body.eventdescription,
    eventphotograph: req.body.eventphotograph,
    starttime: req.body.starttime,
    endtime: req.body.endtime,
    eventdate: req.body.eventdate,
    rating: req.body.rating,
    reviews: req.body.reviews,
    price: req.body.price,
    state: "pendente",
  };

  try {
    const client = await pool.connect();
    await client.query(
      "INSERT INTO events (id, longitude, latitude, eventname, eventdescription, eventphotograph, starttime, endtime, eventdate, rating, reviews, price, state) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
      [
        newEvent.id,
        newEvent.longitude,
        newEvent.latitude,
        newEvent.eventname,
        newEvent.eventdescription,
        newEvent.eventphotograph,
        newEvent.starttime,
        newEvent.endtime,
        newEvent.eventdate,
        newEvent.rating,
        newEvent.reviews,
        newEvent.price,
        newEvent.state,
      ]
    );

    client.release();

    res.json({ message: "Event added successfully!", event: newEvent });
  } catch (error) {
    console.error("Error adding event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//To verify the event and change the state
async function updateEventStates() {
  const currentDate = new Date();

  try {
    const client = await pool.connect();

    // Query to fetch events with past date and "active" status
    const query = `
      UPDATE events
      SET state = 'desativado'
      WHERE eventdate < $1 AND state = 'ativo'
      RETURNING *
    `;
    const values = [currentDate];

    const result = await client.query(query, values);
    const updatedEvents = result.rows;

    //tratar os eventos atualizados conforme necessário

    client.release();
  } catch (error) {
    console.error("Erro ao atualizar os eventos:", error);
  }
}

// To schedule the function to run every 24 hours
setInterval(updateEventStates, 24 * 60 * 60 * 1000);

// To schedule the function to run every 30 minuts
// cron.schedule("*/30 * * * *", () => {
//   updateEventStates();
// });

// Route to delete an event by ID
app.delete("/events/:id", async (req, res) => {
  const eventId = req.params.id;

  try {
    const client = await pool.connect();
    const result = await client.query("DELETE FROM events WHERE id = $1", [
      eventId,
    ]);

    if (result.rowCount === 1) {
      res.json({ message: "Event deleted successfully!" });
    } else {
      res.status(404).json({ error: "Event not found" });
    }

    client.release();
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//nightClubs

// Route to get all nigthClubs
app.get("/nightclubs", async (req, res) => {
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
app.get("/nightclubs/:id", async (req, res) => {
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
app.post("/nightclubs", async (req, res) => {
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

// for the users comments

let comments = [];
//get method
app.get("/comments", async (req, res) => {
  res.json(comments);
});

//post method
app.post("/comments", (req, res) => {
  const newComment = req.body;
  comments.push(newComment);
  res.status(201).json(newComment);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
