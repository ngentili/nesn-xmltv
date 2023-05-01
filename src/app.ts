import { writeXmltv, Xmltv, XmltvChannel, XmltvProgramme } from '@iptv/xmltv';
import axios from 'axios';
import express from 'express';
import moment from 'moment';
import xmlEscape from 'xml-escape';
import NodeCache from 'node-cache';

interface NesnProgram {
    "Start Time (UTC)": string
    "Start Date (UTC)": string
    "Length": string
    "Program Name": string
    "Title Name": string
    "Program Synopsis": string
    "Airing": string
    "Definition": string
    "Format": string
    "Hero": string
    "contentType": string
    "Manifest": string
    "Program Stream": string
}

async function getXmltv() {
    let channelNesn: XmltvChannel = {
        id: 'nesn01',
        displayName: [{ _value: 'NESN', lang: 'en' }],
    }

    let channelNesnPlus: XmltvChannel = {
        id: 'nesn02',
        displayName: [{ _value: 'NESN Plus', lang: 'en' }],
    }

    let channels: XmltvChannel[] = [
        channelNesn,
        channelNesnPlus,
    ]

    let programmes: XmltvProgramme[] = []

    let xmltv: Xmltv = { channels, programmes }

    let res1 = await axios.get<NesnProgram[]>('https://nesn.com/wp-json/nesn/v2/tv?schedule=tvschedule')
    let res2 = await axios.get<NesnProgram[]>('https://nesn.com/wp-json/nesn/v2/tv?schedule=nesnplusschedule')

    let mappings = [
        { channel: channelNesn, data: res1.data },
        { channel: channelNesnPlus, data: res2.data }
    ]

    for (const stuff of mappings) {
        for (const p of stuff.data) {

            let datetime = p['Start Date (UTC)'] + '_' + p['Start Time (UTC)'] // 4/1/2023_4:00:00
            let format = 'M/D/YYYY_H:mm:ss'
            let start = moment.utc(datetime, format, true)

            let startOftoday = moment().startOf('day')
            let endOfTomorrow = moment().add(1, 'day').endOf('day')

            if (!start.isBetween(startOftoday, endOfTomorrow)) {
                continue
            }

            let prog: XmltvProgramme = {
                channel: stuff.channel.id,
                start: start.toDate(),
                title: [{ _value: xmlEscape(p['Program Name']), lang: 'en' }],
                desc: [{ _value: xmlEscape(p['Title Name']), lang: 'en' }],
                image: [{ _value: p.Hero, orient: 'L' }],
            }

            xmltv.programmes!.push(prog)
        }
    }

    let xml = writeXmltv(xmltv)
    return xml
}

const cache = new NodeCache({ stdTTL: 60 * 60 }) // 1 hour cache

const app = express()

app.get('/xmltv', async (req, res) => {
    const cachedXml = cache.get('xml')

    if (cachedXml) {
        console.log('Serving from cache')

        res.header('content-type', 'text/xml')
        res.send(cachedXml);
    }
    else {
        try {
            console.log('Fetching from API')
            let xml = await getXmltv()
            cache.set('xml', xml)

            res.header('content-type', 'text/xml')
            res.send(xml)
        }
        catch (error) {
            console.error(error)

            res.status(500).send('Error fetching XML from API')
        }
    }
});

app.listen(parseInt(process.env.PORT || '') || 80, '0.0.0.0', () => console.log('ready'))
