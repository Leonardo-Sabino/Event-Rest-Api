const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const pool = require("../pool");

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
router.put("/events/:id", async (req, res) => {
  const eventId = req.params.id;
  const updatedEvent = req.body;
  const { userId } = updatedEvent;
  try {
    const client = await pool.connect();
    const result = await client.query(
      "UPDATE events SET longitude = $2, latitude = $3, name = $4, description = $5, image = $6, starttime = $7, endtime = $8, date = $9, price = $10, owner_contact = $11 WHERE id = $1",
      [
        eventId,
        updatedEvent.longitude,
        updatedEvent.latitude,
        updatedEvent.name,
        updatedEvent.description,
        updatedEvent.image,
        updatedEvent.starttime,
        updatedEvent.endtime,
        updatedEvent.date,
        updatedEvent.price,
        updatedEvent.ownerContact,
      ]
    );

    if (result.rowCount === 1) {
      res.json({ message: "Event updated successfully!" });
      // emit the for the users connected that a event has been updated
      websocketServer.emit("eventUpdated", {
        eventId,
        ...updatedEvent,
        userId,
      });
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
  const id = uuidv4();
  const {
    image,
    longitude,
    latitude,
    name,
    description,
    starttime,
    endtime,
    date,
    price,
    userId,
    ownerContact,
  } = req.body;

  try {
    const client = await pool.connect();

    const query = `
      INSERT INTO events (id, longitude, latitude, name, description, image, starttime, endtime, date, price, userId, state, owner_contact)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id `;

    const values = [
      id,
      longitude,
      latitude,
      name,
      description,
      image,
      starttime,
      endtime,
      date,
      price,
      userId,
      "pendente",
      ownerContact,
    ];

    await client.query(`${query}`, values);

    client.release();

    res.json({ message: "Event added successfully!" });
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
      "SELECT * FROM events WHERE id = $1 AND userid = $2",
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

    // Query to get all the liked events liked events
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

//get liked event by id
router.get("/event/likes/:id", async (req, res) => {
  const eventId = req.params.id;
  try {
    const client = await pool.connect();

    // Query for the event existence
    const eventExists = await client.query(
      "SELECT * FROM events WHERE id = $1",
      [eventId]
    );

    // Check if the event exists
    if (eventExists.rows.length === 0) {
      client.release();
      return res.status(404).json({
        message: "Event not found! Check the id of the event",
      });
    }

    // Query for liked events associated with the specified event ID
    const likedEvents = await client.query(
      "SELECT * FROM liked_events WHERE event_id = $1",
      [eventId]
    );

    // Check if any liked events were found
    if (likedEvents.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: "This event has no likes!" });
    }

    client.release();
    return res.status(200).json({
      likesInfo: likedEvents.rows,
      likesCount: likedEvents.rows.length,
    });
  } catch (error) {
    console.log("Error:", error.message);
    if (error.message.includes("invalid input syntax for type uuid:")) {
      return res
        .status(400)
        .json({ message: "Id of the event has to be a uuid" });
    }
    return res.status(500).json({ error: "Internal error occurred" });
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
      return res
        .status(400)
        .json({ message: "Event is already liked by you!" });
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
    if (error.message.includes("invalid input syntax for type uuid:")) {
      return res
        .status(400)
        .json({ message: "Id of the event has to be type uuid" });
    }
    return res.status(500).json({ error: "Internal server error" });
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
    if (error.message.includes("invalid input syntax for type uuid:")) {
      return res
        .status(400)
        .json({ message: "Id of the event has to be type uuid" });
    }
    return res.status(500).json({ error: "Internal server error" });
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
    if (error.message.includes("invalid input syntax for type uuid:")) {
      return res
        .status(400)
        .json({ message: "Id of the event has to be type uuid" });
    }
    return res.status(500).json({ error: "Internal server error occurred!" });
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
    if (error.message.includes("invalid input syntax for type uuid:")) {
      return res
        .status(400)
        .json({ message: "Id of the event has to be type uuid" });
    }
    return res.status(500).json({ error: "Internal server error occurred!" });
  }
});

//To verify the event and change the state
async function updateEventStates(req, res) {
  const currentDate = new Date();
  try {
    const client = await pool.connect();

    // Query to fetch events with past date and "active" status
    const query = `
      UPDATE events
      SET state = 'desativado'
      WHERE date < $1 AND state = 'ativo'
      RETURNING *
    `;
    const values = [currentDate];

    const result = await client.query(query, values);
    const updatedEventsName = result.rows.map((event) => event.name);

    // Release the client connection
    client.release();

    // Return all the events updated
    console.log("Sucessfully updated this events states: ", updatedEventsName);
  } catch (error) {
    console.error("Error updating events:", error);
    return res.status(500).json({ error: "Error updating events" });
  }
}
// To schedule the function to run every 24 hours
setInterval(updateEventStates, 24 * 60 * 60 * 1000);

// To schedule the function to run every 30 minuts
// cron.schedule("*/30 * * * *", () => {
//   updateEventStates();
// });

module.exports = router;
