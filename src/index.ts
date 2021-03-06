import express from 'express';
import { createClient, RedisClient } from 'redis';
import cron from 'node-cron';
import cors from 'cors';
import axios from 'axios';
import { promisify } from 'util';

const app: express.Express = express();
let corsOptions;

if (process.env.NODE_ENV === 'prod') {
    corsOptions = {
        origin: process.env.ORIGIN
    };
} else {
    corsOptions = {
        origin: 'http://localhost:1234'
    };
}

app.use(cors(corsOptions));

const redis: RedisClient = createClient();
const rget: Function = promisify(redis.get).bind(redis);

app.get('/stats', (req: any, res: any) => {
    redis.exists('stats_latest', (err: Error | null, reply: number) => {
        if (err) res.send(500).send(err);
        if (reply) {
            rget('stats_latest').then((data: any) => {
                // Get 'stats_old' if it exists
                rget('stats_old').then((old: string | null) => {
                    const payload = {
                        latest: JSON.parse(data as string),
                        old: JSON.parse(old as string)
                    };
                    res.status(200).json(payload);
                }).catch((e: Error) => {
                    res.status(200).json(JSON.parse(data as string));
                    console.error(e);
                });
            }).catch((e: Error) => {
                res.status(500).send(e);
            });
        } else {
            fetchLatestData().then(rdata => {
                res.status(200).send(rdata);
            }).catch(e => {
                console.error(e);
            });
        }
    });
});

// server listen
if (process.env.NODE_ENV === 'prod') {
    const fs = require('fs');
    const https = require('https');

    // Get the ssl certs
    https.createServer({
        key: fs.readFileSync('/home/admin/privkey.pem'),
        cert: fs.readFileSync('/home/admin/fullchain.pem')
    }, app).listen(3000);
} else {
    app.listen(3000);
}


cron.schedule('0 */15 * * * *', fetchLatestData); 

/*
 * Fetch the latest data
 *
 * @return Promise<object>
 */
function fetchLatestData(): Promise<object> {
    return new Promise((res, rej) => {
        const url = 'https://mcovid19.mizoram.gov.in/api/home-stats';

        axios(url).then(({ data }) => {
            console.info('Data fetched on: ' + (new Date()).toLocaleString());

            rget('stats_latest').then((rdata: string | null) => {
                if (rdata !== null) {
                    const jdata = JSON.parse(rdata);

                    // Check for changed values
                    if (!objectCompare(['samplesTestedPositive', 'personsHospitalised', 'deaths', 'recovered'], data.stats, jdata)) {
                        // If changed values are detected add 'stats_old' with the old data and save the new data
                        // Persist stats_old for 10 hours
                        redis.set('stats_old', rdata);
                        redis.expire('stats_old', 36000);
                        redis.set('stats_latest', JSON.stringify(data.stats));
                    }
                } else {
                    // If the data is null, just set the data
                    redis.set('stats_latest', JSON.stringify(data.stats));
                    res(data.stats);
                }
            }).catch((e: Error) => {
                throw new Error('Error ' + e);
            });
        }).catch(e => {
            rej(e);
            console.error(e);
        });
    });
}

/*
 * Check keys of objects
 * return false if atleast 1 key does not match
 * return true if all keys are the same
 *
 * @param key Array<string> | string
 * @param obj1 { [key: string]: string }
 * @param obj2 { [key: string]: string }
 * @return boolean
 */
function objectCompare(key: Array<string> | string, obj1: { [key: string]: string }, obj2: { [key: string]: string }): boolean {
    if (Array.isArray(key)) {
        for (let i = 0; i < key.length; i++) {
            if (obj1[key[i]] !== obj2[key[i]]) return false;
        }
    } else {
        if (obj1[key] !== obj2[key]) return false;
    }
    return true;
}
