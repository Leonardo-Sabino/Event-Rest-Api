const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const bodyParser = require("body-parser");
const { Expo } = require("expo-server-sdk");
const pool = require("../db/pool");
const authenticationToken = require("../middelware");

// Middlewares
router.use(bodyParser.json());

// get event comements by id
router.get("/comments/:id", async (req, res) => {
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

//notification on comment
// Função para enviar notificação push usando o Expo
const sendPushNotification = async (
  expoPushToken,
  body,
  title,
  eventid,
  eventname,
  userId,
  eventCreatorId,
  notification_id
) => {
  let expo = new Expo();
  const [id, date] = [notification_id, new Date()];
  let messages = [];
  //to Verify if ExpoPushToken is a valid token
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error("ExpoPushToken inválido:", expoPushToken);
    return;
  }

  //to create the mensage to send the notification
  messages.push({
    to: expoPushToken, // to the device
    sound: "default",
    body: body,
    data: {
      id,
      eventid,
      eventname,
      senderid: userId,
      receiverid: eventCreatorId,
      createat: date,
    }, // to sent the event details to the front end
    title: title,
  });

  //to send the notifications
  let chunks = expo.chunkPushNotifications(messages);
  let tickets = [];
  (async () => {
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log("Notificação enviada!");
      } catch (error) {
        console.error("Erro ao enviar notificação:", error);
      }
    }
  })();

  //to store the notification in the db
  try {
    const client = await pool.connect();

    await client.query(
      "INSERT INTO notifications (id,eventid,receiverid,senderid,eventname,title,message,createat) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, eventid, eventCreatorId, userId, eventname, title, body, date]
    );
    client.release();

    console.log("Notification successfully saved!");
  } catch (error) {
    console.error("Error saving notification:", error);
  }
};

// to post a comment
router.post("/comment/event/:id", authenticationToken, async (req, res) => {
  const client = await pool.connect();
  const eventId = req.params.id;
  const userId = req.user.id;
  const { comment } = req.body;

  const userQueryResult = await client.query(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  const eventQueryResult = await client.query(
    `SELECT * FROM events WHERE id = $1`,
    [eventId]
  );

  const username = userQueryResult.rows[0]?.username;
  const eventName = eventQueryResult.rows[0]?.name;

  if (!eventQueryResult.rows[0]) {
    return res.status(404).json({ error: "Event not found" });
  }

  if (comment && typeof comment !== "string") {
    return res.status(400).json({ error: "The comment should be a string" });
  }

  if (!comment || (comment && comment.trim() === "")) {
    return res.status(400).json({ error: "The comment is required" });
  }

  const [id, date, notification_id] = [uuidv4(), new Date(), uuidv4()];

  const newComment = {
    id,
    userid: userId,
    eventid: eventId,
    eventname: eventName,
    comment,
    createdat: date,
    notification_id,
  };

  try {
    await client.query(
      "INSERT INTO comments (id, userid, eventid, eventname, comment, createdat, notification_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [id, userId, eventId, eventName, comment, date, notification_id]
    );

    const eventResult = await client.query(
      "SELECT userid FROM events WHERE id = $1",
      [eventId]
    );

    const eventDetails = eventResult.rows[0];

    const tokenResult = await client.query(
      "SELECT tokendevice FROM users WHERE id = $1",
      [eventDetails.userid]
    );

    const tokenDetails = tokenResult.rows[0];

    //webSocket connnection
    websocketServer.emit("newComment", { ...newComment }); // Emit the "newComment" event to notify all connected clients about the new comment added

    //send notification
    if (
      userId !== eventDetails.userid &&
      tokenDetails &&
      tokenDetails.tokendevice
    ) {
      const message = `${username} comentou no seu evento ${eventName}: "${comment}"`;
      const title = "Novo comentário";

      sendPushNotification(
        tokenDetails.tokendevice,
        message,
        title,
        eventId,
        eventName,
        userId,
        eventDetails.userid,
        notification_id
      );
    }
    res.status(201).json({
      message: `Successfully commented on ${eventName}`,
      id: id,
      comment: comment,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

//to delete a comment
router.delete("/comment/:id", authenticationToken, async (req, res) => {
  const client = await pool.connect();

  const commentId = req.params.id;
  const userId = req.user.id;

  try {
    const commentExists = await client.query(
      "SELECT * FROM comments WHERE id = $1 AND userId = $2",
      [commentId, userId]
    );

    if (commentExists.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found!" });
    }

    const eventId = commentExists.rows[0]?.eventid;

    // query to remove the comment from db
    await client.query("DELETE FROM comments WHERE id = $1 AND eventId = $2", [
      commentId,
      eventId,
    ]);

    // notify the other users
    websocketServer.emit("deleteComment", { id: commentId, userId });

    res.status(200).json({ message: "Comment successfully deleted!" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

//for the liked comments
router.get("/comment/likes", authenticationToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const likes = await client.query("SELECT * FROM likes_comment");

    if (likes.rows.length === 0) {
      return res.status(404).json({ error_message: "No likes found!" });
    }

    res.status(201).json(likes.rows);
  } catch (error) {
    console.log("Error fecthing comment likes:", error);
    res.status(500).json({ error: "Internal error occurred!" });
  } finally {
    client.release();
  }
});

router.post("/comment/likes/:id", authenticationToken, async (req, res) => {
  const commentId = req.params.id;
  const eventId = req.body.eventId;
  const userId = req.user.id;

  const client = await pool.connect();

  try {
    const likeComment = await client.query(
      "SELECT * FROM likes_comment WHERE comment_id = $1 AND user_id = $2 AND event_id = $3",
      [commentId, userId, eventId]
    );

    if (likeComment.rows.length !== 0) {
      return res
        .status(404)
        .json({ error_message: "User has already liked this comment." });
    }

    // Insert a new like
    await client.query(
      "INSERT INTO likes_comment (id, event_id,comment_id ,user_id) VALUES ($1, $2, $3,$4)",
      [uuidv4(), eventId, commentId, userId]
    );
    res.status(201).json({ message: "Comment liked successfully!" });
  } catch (error) {
    console.log("Error liking on comment:", error);
    res.status(500).json({ error: "Internal error occurred!" });
  } finally {
    client.release();
  }
});

router.delete("/comment/likes/:id", authenticationToken, async (req, res) => {
  const commentId = req.params.id;
  const eventId = req.body.eventId;
  const userId = req.user.id;

  const client = await pool.connect();

  try {
    // Check if the like exists for the specified comment, user, and event
    const likeComment = await client.query(
      "SELECT * FROM likes_comment WHERE comment_id = $1 AND user_id = $2 AND event_id = $3",
      [commentId, userId, eventId]
    );

    if (likeComment.rows.length === 0) {
      return res
        .status(404)
        .json({ error_message: "Like on this comment does not exist." });
    }

    // Delete the like associated with the comment, user, and event
    await client.query(
      "DELETE FROM likes_comment WHERE comment_id = $1 AND user_id = $2 AND event_id = $3",
      [commentId, userId, eventId]
    );

    res
      .status(200)
      .json({ message: "Like removed from comment successfully!" });
  } catch (error) {
    console.error("Error removing like from comment:", error);
    res.status(500).json({ error: "Internal error occurred!" });
  } finally {
    client.release();
  }
});

module.exports = router;
