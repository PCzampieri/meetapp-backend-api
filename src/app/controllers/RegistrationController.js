import { Op } from 'sequelize';
import { isBefore } from 'date-fns';
import Registration from '../models/Registration';
import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';

import Queue from '../../lib/Queue';
import RegistrationMail from '../jobs/RegistrationMail';

class RegistrationController {
  async index(req, res) {
    const registration = await Registration.findAll({
      where: {
        user_id: req.userId,
      },
      attributes: ['id'],
      include: [
        {
          model: Meetup,
          as: 'meetup',
          attributes: ['id', 'title', 'description', 'location', 'date'],
          where: {
            date: {
              [Op.gt]: new Date(),
            },
          },
          required: true,
          include: [
            {
              model: File,
              as: 'banner',
              attributes: ['id', 'path', 'url'],
            },
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email'],
            },
          ],
        },
      ],
      order: [['meetup', 'date']],
    });

    const registrations = registration.map(regi => {
      const { id, title, description, location, date, past } = regi.meetup;
      const { url } = regi.meetup.banner;
      const { name } = regi.meetup.user;

      return {
        registration_id: regi.id,
        id,
        title,
        description,
        location,
        date,
        past,
        url,
        name,
      };
    });

    return res.json(registrations);
  }

  async store(req, res) {
    const { meetupId } = req.params;
    const user = await User.findByPk(req.userId);

    const meetup = await Meetup.findByPk(meetupId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
      ],
    });

    if (!meetup) {
      return res.status(401).json({ error: 'Meetup not found' });
    }

    const { date, user_id } = meetup;

    if (user_id === req.userId) {
      return res
        .status(409)
        .json({ error: 'User must be different from meetup organizer' });
    }

    if (isBefore(date, new Date())) {
      return res.status(401).json({ error: 'Past dates are not permitted' });
    }

    const checkRegistration = await Registration.findOne({
      where: { meetup_id: meetupId, user_id: req.userId },
    });

    if (checkRegistration) {
      return res.status(402).json({ error: 'Registration already exists.' });
    }

    const checkDate = await Registration.findOne({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          as: 'meetup',
          required: true,
          where: {
            date,
          },
        },
      ],
    });

    if (checkDate) {
      return res
        .status(403)
        .json({ error: "Can't registration to two meetups at the same time" });
    }

    const dataRegistration = {
      user_id: req.userId,
      meetup_id: meetupId,
    };

    const registration = await Registration.create(dataRegistration);

    await Queue.add(RegistrationMail.key, {
      meetup,
      user,
    });

    return res.json(registration);
  }

  async delete(req, res) {
    const { id } = req.params;

    try {
      await Registration.destroy({ where: { id } });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    return res.json({ ok: true });
  }
}

export default new RegistrationController();
