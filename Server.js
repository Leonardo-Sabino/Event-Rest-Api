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

// Route to update an event by ID (getting error)
app.put("/events/:eventId", async (req, res) => {
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
app.delete("/events/:eventId", async (req, res) => {
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

//for users
app.get("/users", async (req, res) => {
  try {
    const query = "SELECT * FROM users";
    const result = await pool.query(query);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving users." });
  }
});

//post method
app.post("/signup", async (req, res) => {
  const newUser = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
  };

  try {
    const client = await pool.connect();

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
        .json({ error: "Esse nome de usuário já está em uso." });
    }

    // Generate a random token for the new user using uuid
    const token = uuidv4();

    // Insert the new user into the database with the generated token
    await client.query(
      "INSERT INTO users (username,email,password,token) VALUES ($1, $2, $3, $4)",
      [newUser.username, newUser.email, newUser.password, token]
    );

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
app.put("/users/:userId", async (req, res) => {
  let userId = req.params.userId;
  const updatedUser = req.body;

  try {
    const client = await pool.connect();
    const result = await client.query(
      "UPDATE users SET username = $2, email = $3, password = $4 WHERE id = $1",
      [userId, updatedUser.username, updatedUser.email, updatedUser.password]
    );
    if (result.rowCount === 1) {
      res.json({ message: "User updated successfully!" });
    } else {
      res.status(404).json({ message: "User not found!" });
    }
    client.release();
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal error occurred!" });
  }
});

// for the comments

// GET method
app.get("/comments", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT * FROM comments");
    const comments = result.rows;
    client.release();
    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// get event comements by id
app.get("/comments/:eventId", async (req, res) => {
  const eventId = req.params.eventId;

  try {
    const client = await pool.connect();

    // Obtenha os comentários relacionados ao ID do evento fornecido
    const comments = await client.query(
      "SELECT * FROM comments WHERE eventid = $1",
      [eventId]
    );

    client.release();

    res.status(200).json(comments.rows);
  } catch (error) {
    console.error("Error retrieving comments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// to post a comment
app.post("/comments", async (req, res) => {
  const { userId, eventId, username, eventName, comment } = req.body;

  try {
    const client = await pool.connect();

    // to Save the comment to the database
    const commentResult = await client.query(
      "INSERT INTO comments (userId, eventId, username, eventName, comment, createdAt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, eventId, username, eventName, comment, new Date()]
    );

    const savedComment = commentResult.rows[0];

    client.release();

    // Submit the response with the new comment
    res.status(201).json(savedComment);
  } catch (error) {
    console.error("Error adding comment:", error); //show to user the error, add it later front end.
    res.status(500).json({ error: "Internal server error" });
  }
});

//to delete a comment
app.delete("/comments/:commentId", async (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.body.userId; // ID do usuário passado no corpo da solicitação

  try {
    const client = await pool.connect();

    // Verifique se o comentário existe e se o usuário é o autor do comentário
    const commentExists = await client.query(
      "SELECT * FROM comments WHERE id = $1 AND userId = $2",
      [commentId, userId]
    );

    if (commentExists.rows.length === 0) {
      // Comentário não encontrado ou usuário não é o autor
      client.release();
      return res.status(404).json({ error: "Comentário não encontrado" });
    }

    // Exclua o comentário
    await client.query("DELETE FROM comments WHERE id = $1", [commentId]);

    client.release();

    res.status(200).json({ message: "Comentário excluído com sucesso" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
