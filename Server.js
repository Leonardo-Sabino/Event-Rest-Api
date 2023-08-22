const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

// Import the route modules
const eventsRouter = require("./Modules/Events_modules");
const nightclubsRouter = require("./Modules/Nightclubs_modules");
const usersRouter = require("./Modules/Users_modules");
const commentsRouter = require("./Modules/Comments_modules");
const notificationsRouter = require("./Modules/Notifications_modules");

app.use(bodyParser.json());

// Use the route modules

//for the events
app.get("/events", eventsRouter);
app.get("/events/:id", eventsRouter);
app.post("/events", eventsRouter);
app.put("/events/:eventId", eventsRouter);
app.put("/events/:id/state", eventsRouter);
app.delete("/events/:eventId", eventsRouter);

//liked events
app.get("/LikedEvents", eventsRouter);
app.post("/events/likes/:id", eventsRouter);
app.delete("/events/likes/:id", eventsRouter);

//favourites events
app.get("/FavEvents", eventsRouter);
app.post("/events/favourites/:id", eventsRouter);
app.delete("/events/favourites/:id", eventsRouter);

//for the nightclubs
app.get("/nightclubs", nightclubsRouter);
app.get("/nightclubs/:id", nightclubsRouter);
app.post("/nightclubs", nightclubsRouter);

//for the users
app.get("/users/", usersRouter);
app.post("/signup", usersRouter);
app.put("/users/:userId", usersRouter);
app.delete("/users/:userId", usersRouter);
app.post("/tokenDevice/:userId", usersRouter);

//for the comments
app.get("/comments/:eventId", commentsRouter);
app.get("/comments", commentsRouter);
app.post("/comments", commentsRouter);
app.delete("/comments/:commentId", commentsRouter);

//for the notifications
app.get("/notifications", notificationsRouter);
app.delete("/notifications/:notificationId", notificationsRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
