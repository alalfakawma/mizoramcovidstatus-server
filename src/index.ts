import express from 'express';
import fetch from 'node-fetch';
import { createClient } from 'redis';

const app: express.Express = express();

const redis = createClient();

app.get('/stats', (req: any, res: any) => {
    const url = 'https://mcovid19.mizoram.gov.in/api/home-stats';

    redis.exists('stats_today', (err: Error | null, reply: number) => {
        if (err) res.send(500).send(err);

        if (reply) {
            // if exists, get it
            redis.get('stats_today', (err: Error | null, data: string | null) => {
                if (err) res.status(500).send(err);
                res.status(200).json(JSON.parse(data as string));
            });
        } else {
            // not there? fetch it
            fetch(url).then(res => {
                if (!res.ok) {
                    throw new Error('There was an error in fetching the data, status: ' + res.status);
                }
                return res.json();
            }).then(data => {
                redis.set('stats_today', JSON.stringify(data.stats));
                res.status(200).json(data.stats);
            }).catch(e => {
                res.status(500).send(e);
            });
        }
    });
});

// Listen on port 3000
app.listen(3000);
