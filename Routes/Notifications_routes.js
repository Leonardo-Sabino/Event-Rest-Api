const express = require("express");
const router = express.Router();
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

// notifications
router.get("/notifications", async (req, res) => {
  try {
    const client = await pool.connect();
    const savedNotifications = await client.query(
      "SELECT * FROM notifications"
    );
    const notifications = savedNotifications.rows;
    client.release();
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// delete the notifications based on the notifications's id
router.delete("/notifications/:notificationId", async (req, res) => {
  const notificationId = req.params.notificationId;
  const receiverId = req.body.receiverId;

  try {
    const client = await pool.connect();

    const countRows = await client.query(
      "SELECT * FROM notifications WHERE id =$1 AND receiverid = $2",
      [notificationId, receiverId]
    );

    if (countRows.rows.length === 0) {
      client.release();
      return res
        .status(404)
        .json({ error: "Não foi possível eliminar a notificação." });
    }

    await client.query("DELETE FROM notifications WHERE id = $1", [
      notificationId,
    ]);

    res.status(200).json({ message: "Notificação removida com sucesso." });

    client.release();
  } catch (error) {
    console.log("Ocorreu um erro:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
