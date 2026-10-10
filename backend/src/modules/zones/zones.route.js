// TODO [zones.route] Phụ trách: TV2 (#9)
import { Router } from "express";
import * as controller from "./zones.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";

const router = Router();

// [d] #9 – khu vực của sự kiện
router.get("/events/:eventId/zones", controller.listZones);

// [a] #9 – thêm khu vực + giá vé
router.post(
  "/events/:eventId/zones",
  authenticate,
  authorize("ADMIN"),
  controller.createZone,
);

// [c] #9 – sửa khu vực / giá
router.put(
  "/zones/:zoneId",
  authenticate,
  authorize("ADMIN"),
  controller.updateZone,
);

// [b] #9 – xóa khu vực
router.delete(
  "/zones/:zoneId",
  authenticate,
  authorize("ADMIN"),
  controller.deleteZone,
);

// [a] #9 – sinh ghế cho khu vực (bulk insert)
router.post(
  "/zones/:zoneId/generate-seats",
  authenticate,
  authorize("ADMIN"),
  controller.generateSeats,
);

export default router;
