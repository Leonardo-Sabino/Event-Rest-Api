const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Create a new PostgreSQL pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'eventdb',
  password: '19991703',
  port: 5432 // Default PostgreSQL port
});

// Route to get all events
app.get('/events', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM events');
    const events = result.rows;
    client.release();
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get a single event by ID
app.get('/events/:id', async (req, res) => {
  const eventId = req.params.id;
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
    const event = result.rows[0];
    client.release();
    if (event) {
      res.json(event);
    } else {
      res.status(404).json({ error: 'Event not found' });
    }
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to update an event by ID
app.put('/events/:id', async (req, res) => {
  const eventId = req.params.id;
  const updatedEvent = req.body;

  try {
    const client = await pool.connect();
    const result = await client.query('UPDATE events SET longitude = $2, latitude = $3, eventName = $4, eventDescription = $5, eventPhotograph = $6, startTime = $7, endTime = $8, eventDate = $9, rating = 10$, reviews = 11$, price = 12$ WHERE id = $1', [
      eventId,
      updatedEvent.longitude,
      updatedEvent.latitude,
      updatedEvent.eventName,
      updatedEvent.eventDescription,
      updatedEvent.eventPhotograph,
      updatedEvent.startTime,
      updatedEvent.endTime,
      updatedEvent.eventDate,
      updatedEvent.rating,
      updatedEvent.reviews,
      updatedEvent.price
    ]);

    if (result.rowCount === 1) {
      res.json({ message: 'Event updated successfully!' });
    } else {
      res.status(404).json({ error: 'Event not found' });
    }

    client.release();
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to add a new event with rating, reviews, and price
app.post('/events', async (req, res) => {
  const newEvent = {
    id: uuidv4(),
    longitude: req.body.longitude,
    latitude: req.body.latitude,
    eventName: req.body.eventName,
    eventDescription: req.body.eventDescription,
    eventPhotograph: req.body.eventPhotograph,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    eventDate: req.body.eventDate,
    rating: req.body.rating,
    reviews: req.body.reviews,
    price: req.body.price
  };

  try {
    const client = await pool.connect();
    await client.query('INSERT INTO events (id, longitude, latitude, eventName, eventDescription, eventPhotograph, startTime, endTime, eventDate, rating, reviews, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)', [
      newEvent.id,
      newEvent.longitude,
      newEvent.latitude,
      newEvent.eventName,
      newEvent.eventDescription,
      newEvent.eventPhotograph,
      newEvent.startTime,
      newEvent.endTime,
      newEvent.eventDate,
      newEvent.rating,
      newEvent.reviews,
      newEvent.price
    ]);

    client.release();

    res.json({ message: 'Event added successfully!', event: newEvent });
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to delete an event by ID
app.delete('/events/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    const client = await pool.connect();
    const result = await client.query('DELETE FROM events WHERE id = $1', [eventId]);

    if (result.rowCount === 1) {
      res.json({ message: 'Event deleted successfully!' });
    } else {
      res.status(404).json({ error: 'Event not found' });
    }

    client.release();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to delete expired events
async function deleteExpiredEvents() {
  try {
    const client = await pool.connect();

    // Get the current date and time
    const currentDate = new Date().toISOString();

    // Delete events where the eventDate is less than the current date
    const result = await client.query('DELETE FROM events WHERE eventdate < $1', [currentDate]);

    console.log(`Deleted ${result.rowCount} expired event(s)`);

    client.release();
  } catch (error) {
    console.error('Error deleting expired events:', error);
  }
}
// Schedule a task to delete expired events periodically (e.g., once per day)
setInterval(deleteExpiredEvents, 24 * 60 * 60 * 1000); // Run every 24 hours

//nightClubs

// Route to get all nigthClubs
app.get('/nightclubs', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM nightclubs');
    const nightclub = result.rows;
    client.release();
    res.json(nightclub);
  } catch (error) {
    console.error('Error fetching nightclub:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get a single event by ID
app.get('/nightclubs/:id', async (req, res) => {
  const nightclubId = req.params.id;
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM nightclubs WHERE id = $1', [nightclubId]);
    const nightclub = result.rows[0];
    client.release();
    if (nightclub) {
      res.json(nightclub);
    } else {
      res.status(404).json({ error: 'Nightclub not found' });
    }
  } catch (error) {
    console.error('Error fetching nightclub:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to add a new nightclub
app.post('/nightclubs', async (req, res) => {
  const newNightclub = {
    id: uuidv4(),
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    name: req.body.name,
    description: req.body.description,
    image: req.body.image,
    rating: req.body.rating,
    reviews: req.body.reviews
  };

  try {
    const client = await pool.connect();
    await client.query('INSERT INTO nightclubs (id, latitude, longitude, name, description, image, rating, reviews) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
      newNightclub.id,
      newNightclub.latitude,
      newNightclub.longitude,
      newNightclub.name,
      newNightclub.description,
      newNightclub.image,
      newNightclub.rating,
      newNightclub.reviews
    ]);

    client.release();

    res.json({ message: 'Nightclub added successfully!', nightclub: newNightclub });
  } catch (error) {
    console.error('Error adding nightclub:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
