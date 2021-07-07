import express, { Request, Response } from 'express'
import { loginCheck } from '../controllers/loginController'
import { LoginErrors } from '../types'

// set router up
const router = express.Router();

// log in logging middleware specific to this router
router.use(function timeLog (req: Request, res: Response, next) {
  console.log('Log in attempt at time: ', Date.now())
  next()
})

// log in routes below e.g. ../login/...
router.post('/request', (req: Request, res: Response) => {
  const result: LoginErrors = loginCheck(req.body);
  res.json(result);
})

// export the router object
export default router;