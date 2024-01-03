/**
 * @openapi
 * components:
 *  schemas:
 *    CreateUserInput:
 *      type:object
 *          required:
 *            -username
 *            -password
 *            -email
 *            -gender
 *          properties:
 *            email:
 *             type: string
 *             default: jane.doe@example.com
 */

const Event = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    description: { type: "string" },
  },
};

module.exports = Event;
