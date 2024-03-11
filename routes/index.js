import express from 'express'
import AppController from '../controllers/AppController'

const router = express.Router();

router.get('/status', AppController.getStatus);
router.get('/stats', Appcontroller.getStats);

export default router;
