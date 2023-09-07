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

// Route to get all events
router.get("/events", async (req, res) => {
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
router.get("/events/:id", async (req, res) => {
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

// Route to update an event by ID (getting error)
router.put("/events/:eventId", async (req, res) => {
  const eventId = req.params.eventId;
  const updatedEvent = req.body;

  try {
    const client = await pool.connect();
    const result = await client.query(
      "UPDATE events SET longitude = $2, latitude = $3, eventname = $4, eventdescription = $5, eventphotograph = $6, starttime = $7, endtime = $8, eventdate = $9, price = $10 WHERE id = $1",
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
router.put("/events/:id/state", async (req, res) => {
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
      return res.status(404).json({ error: "Event not found" });
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
router.post("/events", async (req, res) => {
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
    userId: req.body.userId,
    userName: req.body.userName,
    state: "pendente",
  };

  try {
    const client = await pool.connect();
    await client.query(
      "INSERT INTO events (id, longitude, latitude, eventname, eventdescription, eventphotograph, starttime, endtime, eventdate, rating, reviews, price, userId,userName, state) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
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
        newEvent.userId,
        newEvent.userName,
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

// Route to delete an event by ID
router.delete("/events/:eventId", async (req, res) => {
  const eventId = req.params.eventId;
  const userId = req.body.userId; // ID do usuário passado no corpo da solicitação

  try {
    const client = await pool.connect();

    // Check if the comment exists and if the user is the author of the comment
    const EventExists = await client.query(
      "SELECT * FROM events WHERE id = $1 AND userId = $2",
      [eventId, userId]
    );

    if (EventExists.rows.length === 0) {
      // event not found or user not posting
      client.release();
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    // To delete the event
    await client.query("DELETE FROM events WHERE id = $1", [eventId]);

    client.release();

    res.status(200).json({ message: "Evento excluído com sucesso" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//liked events

router.get("/LikedEvents", async (req, res) => {
  try {
    const client = await pool.connect();

    // Query for liked events associated with the specified event ID
    const likedEvents = await client.query("SELECT * FROM liked_events");

    // Check if any liked events were found
    if (likedEvents.rows.length === 0) {
      client.release();
      return res.status(404).json({ error_message: "Liked events not found" });
    }

    client.release();
    return res.status(200).json(likedEvents.rows); // Return the result as json
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Internal error occured" });
  }
});

//add like
router.post("/events/likes/:id", async (req, res) => {
  const eventId = req.params.id;
  const userId = req.body.userId;

  try {
    const client = await pool.connect();

    // Check if the event has NOT been liked by the user
    const likedEvents = await client.query(
      "SELECT * FROM liked_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    if (likedEvents.rows.length > 0) {
      client.release();
      return res.status(400).json({ message: "Você já curtiu este evento" });
    }

    // Insert the liked event
    await client.query(
      "INSERT INTO liked_events (id, user_id, event_id) VALUES ($1, $2, $3)",
      [uuidv4(), userId, eventId]
    );

    client.release();
    return res.status(200).json({ message: "Event Liked!" });
  } catch (error) {
    console.error("Error liking event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//remove like from events
router.delete("/events/likes/:id", async (req, res) => {
  const eventId = req.params.id;
  const userId = req.body.userId;

  try {
    const client = await pool.connect();

    // Check if the user has liked the event
    let result = await client.query(
      "SELECT * FROM liked_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      client.release();
      return res
        .status(404)
        .json({ message: "Event not found in liked events" });
    }

    // Delete the liked event
    await client.query(
      "DELETE FROM liked_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    client.release();
    return res.status(200).json({ message: "Event disliked" });
  } catch (error) {
    console.error("Error disliking event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//fourites events
router.get("/FavEvents", async (req, res) => {
  try {
    const client = await pool.connect();
    const favorites = await client.query("SELECT * FROM fav_events");

    //to see if there is favourites events
    if (favorites.rows.length === 0) {
      client.release();
      return res
        .status(400)
        .json({ error_message: "No favourites events found" });
    }
    client.release();
    res.status(200).json(favorites.rows);
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Internal error occured" });
  }
});

//add to favourites
router.post("/events/favourites/:id", async (req, res) => {
  const eventId = req.params.id;
  const userId = req.body.userId;

  try {
    const client = await pool.connect();
    const favorites = await client.query(
      "SELECT * FROM fav_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    if (favorites.rows.length > 0) {
      client.release();
      return res
        .status(400)
        .json({ error_message: "You already have this event as a favorite" });
    }

    await client.query(
      "INSERT INTO fav_events (id, user_id, event_id) VALUES ($1, $2, $3)",
      [uuidv4(), userId, eventId]
    );

    client.release();
    return res.status(200).json({ message: "Event added to favourites!" });
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Internal server error occurred!" });
  }
});

//remove from favorites
router.delete("/events/favourites/:id", async (req, res) => {
  const eventId = req.params.id;
  const userId = req.body.userId;

  try {
    const client = await pool.connect();
    const favorites = await client.query(
      "SELECT * FROM fav_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    if (favorites.rows.length === 0) {
      client.release();
      return res.status(404).json({ error_message: "Event does not exist" });
    }

    await client.query(
      "DELETE FROM fav_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    client.release();
    return res.status(200).json({ message: "Event removed from favourites!" });
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Internal server error occurred!" });
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

module.exports = router;
