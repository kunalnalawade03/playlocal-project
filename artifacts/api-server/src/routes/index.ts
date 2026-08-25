import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playlocalRouter from "./playlocal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playlocalRouter);

export default router;
