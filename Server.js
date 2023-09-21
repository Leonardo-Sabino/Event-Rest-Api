const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;
const http = require("http"); // Import the http module
const socketIo = require("socket.io");

// Import the route modules
const eventsRouter = require("./Routes/Events_routes");
const nightclubsRouter = require("./Routes/Nightclubs_routes");
const usersRouter = require("./Routes/Users_routes");
const commentsRouter = require("./Routes/Comments_routes");
const notificationsRouter = require("./Routes/Notifications_routes");

app.use(bodyParser.json());

//web sockect

const server = http.createServer(app); // Create an HTTP server using Express app

const websocketServer = socketIo(server); // Attach WebSocket server to the HTTP server

global.websocketServer = websocketServer; // delacre websocketServer as global so i can get acess on the methods of users

// listen to connections from clients
websocketServer.on("connection", (socket) => {
  console.log("Client connected");

  // Listen for user updates and broadcast them to connected clients
  socket.on("userUpdate", (updatedUser) => {
    // Emit the updated user to all connected clients
    websocketServer.emit("userUpdate", updatedUser);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

//route modules

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

//for likes on comments
app.get("/comment/likes", commentsRouter);
app.post("/comment/likes/:id", commentsRouter);
app.delete("/comment/likes/:id", commentsRouter);

//for the notifications
app.get("/notifications", notificationsRouter);
app.delete("/notifications/:notificationId", notificationsRouter);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
