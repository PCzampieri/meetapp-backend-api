import * as Yup from 'yup';
import { Op } from 'sequelize';
import { parseISO, isBefore, startOfDay, endOfDay } from 'date-fns';

import Meetup from '../models/Meetup';
import File from '../models/File';
import User from '../models/User';

class MeetupControler {
  async show(req, res) {
    const meetup = await Meetup.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: File,
          as: 'banner',
          attributes: ['id', 'path', 'url'],
        },
      ],
    });

    if (!meetup) {
      return res.status(400).json({ erro: 'meetup not found' });
    }

    if (meetup.user_id !== req.userId) {
      return res.status(400).json({ erro: 'not authorized' });
    }

    const {
      id,
      title,
      description,
      location,
      date,
      banner,
      past,
      user,
    } = meetup;

    return res.json({
      id,
      title,
      description,
      location,
      date,
      past,
      banner,
      user,
    });
  }

  async index(req, res) {
    const where = {};
    const page = req.query.page || 1;

    if (req.query.date) {
      const searchDate = parseISO(req.query.date);

      where.date = {
        [Op.between]: [startOfDay(searchDate), endOfDay(searchDate)],
      };
    }

    const meetups = await Meetup.findAndCountAll({
      where,
      attributes: ['id', 'description', 'title', 'date', 'location', 'past'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: File,
          as: 'banner',
          attributes: ['id', 'path', 'url'],
        },
      ],
      limit: 10,
      offset: 10 * page - 10,
      order: [['date', 'ASC']],
    });

    res.set('x-total-count', meetups.count);

    return res.json(meetups.rows);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().required(),
      description: Yup.string().required(),
      location: Yup.string().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const { title, description, location, date, banner_id } = req.body;

    if (isBefore(parseISO(date), new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted' });
    }

    const checkDate = await Meetup.findOne({
      where: {
        user_id: req.userId,
        date,
      },
    });

    if (checkDate) {
      return res
        .status(403)
        .json({ error: "Can't schedule two meetup at the same time" });
    }

    const meetup = await Meetup.create({
      title,
      description,
      location,
      date,
      banner_id,
      user_id: req.userId,
    });

    return res.json(meetup);
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().required(),
      description: Yup.string().required(),
      location: Yup.string().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const meetup = await Meetup.findByPk(req.params.id);

    if (!meetup) {
      return res.status(400).json({ error: 'Meetup not found' });
    }

    if (meetup.user_id !== req.userId) {
      return res.status(400).json({ error: 'Only the organizer can change' });
    }

    if (isBefore(parseISO(req.body.date), new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted' });
    }

    await meetup.update(req.body);

    const {
      id,
      title,
      description,
      location,
      date,
      banner,
    } = await Meetup.findByPk(req.params.id, {
      include: [
        {
          model: File,
          as: 'banner',
          attributes: ['id', 'path', 'url'],
        },
      ],
    });

    return res.json({
      id,
      title,
      description,
      location,
      date,
      banner,
      user_id: req.userId,
    });
  }

  async delete(req, res) {
    const meetup = await Meetup.findByPk(req.params.id);

    if (!meetup) {
      return res.json({ error: 'Meetup not found!' });
    }

    if (meetup.user_id !== req.userId) {
      return res.status(400).json({ error: 'Only the organizer can delete' });
    }

    if (isBefore(meetup.date, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted' });
    }

    await Meetup.destroy({ where: { id: req.params.id } });

    return res.json({ ok: true });
  }
}

export default new MeetupControler();
