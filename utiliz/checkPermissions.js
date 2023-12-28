const ROLES_LIST = require("../config/roles_list");
const isValidUUID = require("./uuidValidation");

function checkEventStatePermission(req, res, next) {
  const userRole = req.body.user.role_id;

  if (
    userRole &&
    (userRole === ROLES_LIST.Admin || userRole === ROLES_LIST.Editor)
  ) {
    next();
  } else {
    return res
      .status(403)
      .json({ error: "Unauthorized: Insufficient permissions" });
  }
}

module.exports = checkEventStatePermission;
