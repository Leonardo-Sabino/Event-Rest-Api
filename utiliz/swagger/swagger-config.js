const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Onde k bada Api Documentation",
      version: "1.0.0",
      description: "API documentation",
    },
    components: {
      securitySchemas: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  apis: ["./Routes/*.js", "./schemas/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

function swaggerDocs(app, port) {
  // Swagger UI page
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // API documentation in JSON format
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-type", "application/json");
    res.send(swaggerSpec);
  });
  console.log(`Docs are available at http://localhost:${port}/docs`);
}

module.exports = swaggerDocs;
