import Mail from '../../lib/Mail';

class RegistrationMail {
  get key() {
    return 'RegistrationMail';
  }

  async handle({ data }) {
    const { meetup, user } = data;

    await Mail.sendMail({
      to: `${meetup.user.name} <${meetup.user.email}>`,
      subject: 'Nova inscrição efetuada!',
      template: 'registration',
      context: {
        organizer: meetup.user.name,
        meetup: meetup.title,
        user: user.name,
        email: user.email,
      },
    });
  }
}

export default new RegistrationMail();
