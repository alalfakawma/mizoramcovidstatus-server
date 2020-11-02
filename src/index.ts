import express from 'express';

const app: express.Express = express();

// app.use(cors());
// app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.status(200).send('Cool');
});

export default app;
