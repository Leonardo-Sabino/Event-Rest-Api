const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const { Expo } = require("expo-server-sdk");

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

// GET method
router.get("/comments", async (req, res) => {
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
router.get("/comments/:eventId", async (req, res) => {
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
  eventId,
  eventName,
  userId,
  eventCreatorId
) => {
  let expo = new Expo();
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
    data: { eventId: eventId, eventName: eventName }, // to sent the event details to the front end
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
      "INSERT INTO notifications (id,eventid,receiverid,senderid,eventname,message,createat) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [uuidv4(), eventId, eventCreatorId, userId, eventName, body, new Date()]
    );
    client.release();

    console.log("Notification successfully saved!");
  } catch (error) {
    console.error("Error saving notification:", error);
  }
};

// to post a comment
router.post("/comments", async (req, res) => {
  const { userId, eventId, username, eventName, comment } = req.body;
  const [id, date] = [uuidv4(), new Date()];

  const newComment = {
    id,
    userid: userId,
    eventid: eventId,
    eventname: eventName,
    comment,
    createdat: date,
  };

  try {
    const client = await pool.connect();

    // Salvar o comentário no banco de dados
    const commentResult = await client.query(
      "INSERT INTO comments (id, userid, eventid, eventname, comment, createdat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [id, userId, eventId, eventName, comment, date]
    );

    const savedComment = commentResult.rows[0];

    // Obter os detalhes do evento associado ao eventId para obter o id do user que criou o evento
    const eventResult = await client.query(
      "SELECT userid FROM events WHERE id = $1",
      [eventId]
    );

    const eventDetails = eventResult.rows[0];

    // Obter os detalhes do token associado ao userId para enviar a notificação
    const tokenResult = await client.query(
      "SELECT tokendevice FROM users WHERE id = $1",
      [eventDetails.userid]
    );

    const tokenDetails = tokenResult.rows[0];

    //webSocket connnection
    websocketServer.emit("newComment", { ...newComment }); // Emit the "newComment" event to notify all connected clients about the new comment added

    // Enviar notificação se o usuário que comentou no evento for diferente do creatorUserId e se o token device existir
    if (
      userId !== eventDetails.userid &&
      tokenDetails &&
      tokenDetails.tokendevice
    ) {
      const message = `${username} comentou no seu evento ${eventName}: "${comment}"`;
      const title = "Novo comentário";
      console.log("Message:", message);

      // Enviar a notificação push usando o Expo
      sendPushNotification(
        tokenDetails.tokendevice,
        message,
        title,
        eventId,
        eventName,
        userId,
        eventDetails.userid
      );
    }

    client.release();

    // Enviar a resposta com o novo comentário
    // res.status(201).json(savedComment)
    //res without body
    res.status(204).end();
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
//to delete a comment
router.delete("/comments/:commentId", async (req, res) => {
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

    // Excluding the comentary
    await client.query("DELETE FROM comments WHERE id = $1", [commentId]);

    // notify the other users
    websocketServer.emit("deleteComment", { id: commentId, userId });

    client.release();

    res.status(204).end(); // response without body
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//for the liked comments
router.get("/comment/likes", async (req, res) => {
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
    client.release(); // Release the client connection in a finally block
  }
});

router.post("/comment/likes/:id", async (req, res) => {
  const commentId = req.params.id;
  const eventId = req.body.eventId;
  const userId = req.body.userId;

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

router.delete("/comment/likes/:id", async (req, res) => {
  const commentId = req.params.id;
  const eventId = req.body.eventId;
  const userId = req.body.userId;

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
