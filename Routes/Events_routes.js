const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const bodyParser = require("body-parser");
const pool = require("../db/pool");
const checkEventStatePermission = require("../utiliz/checkPermissions");
const authenticationToken = require("../middelware");

// Middlewares
router.use(bodyParser.json());

// Route to get all events
router.get("/events", authenticationToken, async (req, res) => {
  const {
    page = 1,
    limit = 10,
    startTime,
    endTime,
    name,
    maxPrice,
    minPrice,
  } = req.query;
  try {
    const offset = (page - 1) * limit;

    const client = await pool.connect();

    const query = `SELECT * FROM events ORDER BY id OFFSET $1 LIMIT $2`;

    const result = await client.query(query, [offset, limit]);

    const events = result.rows;
    let filteredEvents = [...events];

    if (startTime) {
      const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
      if (!timePattern.test(startTime)) {
        return res.status(400).json({
          error:
            "Invalid format for the time. Please use the format hh:mm or hh:mm:ss",
        });
      } else {
        let searchQuery = startTime;
        if (startTime.split(":").length === 2) {
          searchQuery += ":00";
        }
        filteredEvents = filteredEvents.filter(
          (event) => event.starttime === searchQuery
        );
      }
    }

    if (endTime) {
      const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
      if (!timePattern.test(endTime)) {
        return res.status(400).json({
          error:
            "Invalid format for the time. Please use the format hh:mm or hh:mm:ss",
        });
      } else {
        let searchQuery = endTime;
        if (endTime.split(":").length === 2) {
          searchQuery += ":00";
        }
        filteredEvents = filteredEvents.filter(
          (event) => event.endtime === searchQuery
        );
      }
    }

    if (name) {
      const searchQuery = name.toLowerCase();
      filteredEvents = filteredEvents.filter((event) =>
        event.name.toLowerCase().includes(searchQuery)
      );
    }

    if (maxPrice && minPrice) {
      filteredEvents = filteredEvents.filter((event) => {
        const eventPrice = parseInt(event.price);
        const min = parseInt(minPrice);
        const max = parseInt(maxPrice);

        return eventPrice >= min && eventPrice <= max;
      });
    } else if (maxPrice) {
      filteredEvents = filteredEvents.filter(
        (event) => parseInt(event.price) <= parseInt(maxPrice)
      );
    } else if (minPrice) {
      filteredEvents = filteredEvents.filter(
        (event) => parseInt(event.price) >= parseInt(minPrice)
      );
    }

    client.release();
    res.json(
      filteredEvents.map((event) => {
        return {
          ...event,
          image: event.image.substring(0, 20),
        };
      })
    );
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get a single event by ID
router.get("/events/:id", authenticationToken, async (req, res) => {
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
router.put("/events/:id", authenticationToken, async (req, res) => {
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
router.put(
  "/events/:id/state",
  checkEventStatePermission,
  authenticationToken,
  async (req, res) => {
    const eventId = req.params.id;
    const newState = req.body.state;
    try {
      if (!newState || typeof newState !== "string") {
        return res
          .status(400)
          .json({ error: "A valid new state has to be provided" });
      }

      const client = await pool.connect();

      // Check if the event exists
      const existingEvent = await client.query(
        "SELECT * FROM events WHERE id = $1",
        [eventId]
      );

      if (existingEvent.rows.length === 0) {
        // Event not found
        return res.status(404).json({ error: "Event not found" });
      }
      await client.query("UPDATE events SET state = $1 WHERE id = $2", [
        newState,
        eventId,
      ]);

      client.release();

      res.json({
        message: "Event state updated successfully!",
        eventName: existingEvent.rows[0].name,
        newState,
      });
    } catch (error) {
      console.error("Error updating event state:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Route to add a new event
router.post("/events", authenticationToken, async (req, res) => {
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
      "pending",
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
router.delete("/events/:id", authenticationToken, async (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;

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

router.get("/events/likes/me", authenticationToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();

    const likedEvents = await client.query(
      "SELECT * FROM liked_events WHERE user_id = $1",
      [userId]
    );

    if (likedEvents.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: "No liked events found" });
    }

    const eventIds = likedEvents.rows.map((item) => item.event_id);

    const eventsQuery = `SELECT * FROM events WHERE id = ANY($1)`;

    const events = await client.query(eventsQuery, [eventIds]);

    const formattedEvents = events.rows.map((event) => ({
      ...event,
      image: event.image.substring(0, 20),
    }));

    client.release();

    return res.status(200).json({
      events: formattedEvents,
      count: formattedEvents.length,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error occurred" });
  }
});

//get liked event by id
router.get("/events/all/likes", authenticationToken, async (req, res) => {
  try {
    const client = await pool.connect();

    // Query to retrieve liked events
    const likedEvents = await client.query(`SELECT * FROM liked_events`);

    // Check if any liked events exist
    if (likedEvents.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: "No liked events found" });
    }

    const likedEventIds = likedEvents.rows.map((item) => item.event_id);

    // Query to fetch details of the liked events using their IDs
    const events = await client.query(
      `SELECT * FROM events WHERE id = ANY($1)`,
      [likedEventIds]
    );

    const data = events.rows.map((event) => {
      const likedEventsForEvent = likedEvents.rows.filter(
        (likedEvent) => likedEvent.event_id === event.id
      );

      const userIds = likedEventsForEvent.map(
        (likedEvent) => likedEvent.user_id
      );

      return {
        eventId: event.id,
        userIds: userIds,
        count: userIds.length,
        isLikedByMe: userIds.includes(req.user.id),
      };
    });

    client.release();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error:", error);
    if (error.message.includes("invalid input syntax for type uuid:")) {
      return res.status(400).json({ message: "Event id must be a UUID" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

//add like
router.post("/events/:id/likes", authenticationToken, async (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;

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
        .status(409)
        .json({ message: "This event is already liked by you!" });
    }

    // Insert the liked event
    await client.query(
      "INSERT INTO liked_events (id, user_id, event_id) VALUES ($1, $2, $3)",
      [uuidv4(), userId, eventId]
    );

    client.release();
    return res.status(200).json({ message: "Event sucessfully liked!" });
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
router.delete("/events/:id/likes", authenticationToken, async (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;

  try {
    const client = await pool.connect();

    // Check if the user has liked the event
    let result = await client.query(
      "SELECT * FROM liked_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: "Event not found" });
    }

    // Delete the liked event
    await client.query(
      "DELETE FROM liked_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    client.release();
    return res.status(200).json({ message: "Event sucessfully disliked" });
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
router.get("/events/favorites/me", authenticationToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();

    const favoriteEventsQuery = `
      SELECT event_id FROM fav_events WHERE user_id = $1
    `;
    const favoriteEvents = await client.query(favoriteEventsQuery, [userId]);

    if (favoriteEvents.rows.length === 0) {
      client.release();
      return res.status(404).json({
        error: "No favorite events found",
      });
    }

    const eventIds = favoriteEvents.rows.map((fav) => fav.event_id);

    const eventsQuery = `
      SELECT * FROM events WHERE id = ANY($1)
    `;
    const events = await client.query(eventsQuery, [eventIds]);

    const formattedEvents = events.rows.map((event) => ({
      ...event,
      image: event.image.substring(0, 20),
    }));

    client.release();

    res.status(200).json({
      events: formattedEvents,
      count: formattedEvents.length,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal error occurred" });
  }
});

//add to favourites
router.post("/events/:id/favourites", authenticationToken, async (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;

  try {
    const client = await pool.connect();
    const favorites = await client.query(
      "SELECT * FROM fav_events WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    if (favorites.rows.length > 0) {
      client.release();
      return res.status(409).json({
        error: "You already have this event in your favourite events list",
      });
    }

    await client.query(
      "INSERT INTO fav_events (id, user_id, event_id) VALUES ($1, $2, $3)",
      [uuidv4(), userId, eventId]
    );

    client.release();
    return res
      .status(200)
      .json({ message: "Event sucessfully added to favourites!" });
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
router.delete(
  "/events/:id/favourites",
  authenticationToken,
  async (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;

    try {
      const client = await pool.connect();

      const deleteQuery = `
        DELETE FROM fav_events
        WHERE event_id = $1 AND user_id = $2
        RETURNING *
      `;

      const deletedEvent = await client.query(deleteQuery, [eventId, userId]);

      client.release();

      if (deletedEvent.rowCount === 0) {
        return res.status(404).json({ error_message: "Event does not exist" });
      }

      return res
        .status(200)
        .json({ message: "Event removed from favourites!" });
    } catch (error) {
      console.error("Error:", error);

      if (error.message.includes("invalid input syntax for type uuid:")) {
        return res
          .status(400)
          .json({ message: "Id of the event has to be type uuid" });
      }

      return res.status(500).json({ error: "Internal server error occurred!" });
    }
  }
);

//To verify the event and change the state
async function updateEventStates(req, res) {
  const currentDate = new Date();
  try {
    const client = await pool.connect();

    // Query to fetch events with past date and "active" status
    const query = `
      UPDATE events
      SET state = 'deactivated'
      WHERE date < $1 AND state = 'active'
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
