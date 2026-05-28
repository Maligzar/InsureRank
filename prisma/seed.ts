/* eslint-disable no-console */
import {
  PrismaClient,
  LineOfBusiness,
  SourceChannel,
  Temperature,
  Role,
  AgentStatus,
} from '@prisma/client'
import { hash } from 'bcrypt'

const db = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const org = await db.organization.upsert({
    where: { slug: 'apex-insurance' },
    update: {},
    create: {
      name: 'Apex Insurance Agency',
      slug: 'apex-insurance',
      plan: 'pro',
      timezone: 'America/Chicago',
    },
  })

  const passwordHash = await hash('Password123!', 10)

  const adminUser = await db.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'admin@apex-insurance.com' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'admin@apex-insurance.com',
      passwordHash,
      name: 'Sarah Chen',
    },
  })

  const agentUser1 = await db.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'james@apex-insurance.com' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'james@apex-insurance.com',
      passwordHash,
      name: 'James Rivera',
    },
  })

  const agentUser2 = await db.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'mia@apex-insurance.com' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'mia@apex-insurance.com',
      passwordHash,
      name: 'Mia Thompson',
    },
  })

  const adminAgent = await db.agent.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      orgId: org.id,
      userId: adminUser.id,
      role: Role.ORG_ADMIN,
      licenseNumber: 'IL-1234567',
      licenseState: 'IL',
      licenseExpiry: new Date('2026-12-31'),
      rankScore: 92.5,
      status: AgentStatus.ACTIVE,
    },
  })

  const agent1 = await db.agent.upsert({
    where: { userId: agentUser1.id },
    update: {},
    create: {
      orgId: org.id,
      userId: agentUser1.id,
      role: Role.AGENT,
      licenseNumber: 'IL-7654321',
      licenseState: 'IL',
      licenseExpiry: new Date('2026-06-30'),
      rankScore: 78.3,
      status: AgentStatus.ACTIVE,
    },
  })

  const agent2 = await db.agent.upsert({
    where: { userId: agentUser2.id },
    update: {},
    create: {
      orgId: org.id,
      userId: agentUser2.id,
      role: Role.AGENT,
      licenseNumber: 'IL-9988776',
      licenseState: 'IL',
      licenseExpiry: new Date('2027-03-31'),
      rankScore: 85.1,
      status: AgentStatus.ACTIVE,
    },
  })

  const stageDefinitions = [
    { name: 'New Lead', position: 0, probability: 0.1, isDefault: true },
    { name: 'Contacted', position: 1, probability: 0.25 },
    { name: 'Needs Analysis', position: 2, probability: 0.4 },
    { name: 'Quoted', position: 3, probability: 0.6 },
    { name: 'Pending Approval', position: 4, probability: 0.8 },
    { name: 'Bound', position: 5, probability: 1.0, isClosed: true, isWon: true },
    { name: 'Lost', position: 6, probability: 0, isClosed: true },
  ]

  const stages = await Promise.all(
    stageDefinitions.map((s) =>
      db.pipelineStage.upsert({
        where: { id: `seed-stage-${s.position}` },
        update: {},
        create: {
          id: `seed-stage-${s.position}`,
          orgId: org.id,
          name: s.name,
          position: s.position,
          probability: s.probability,
          isDefault: s.isDefault ?? false,
          isClosed: s.isClosed ?? false,
          isWon: s.isWon ?? false,
        },
      })
    )
  )

  await db.carrier.upsert({
    where: { id: 'seed-carrier-1' },
    update: {},
    create: {
      id: 'seed-carrier-1',
      orgId: org.id,
      name: 'Nationwide Mutual',
      active: true,
    },
  })

  const contactData = [
    {
      first: 'Robert',
      last: 'Adams',
      email: 'radams@email.com',
      phone: '3125550101',
      lob: LineOfBusiness.LIFE,
      src: SourceChannel.WEB_FORM,
      temp: Temperature.HOT,
    },
    {
      first: 'Linda',
      last: 'Baker',
      email: 'lbaker@email.com',
      phone: '3125550102',
      lob: LineOfBusiness.PNC,
      src: SourceChannel.REFERRAL,
      temp: Temperature.WARM,
    },
    {
      first: 'Carlos',
      last: 'Martinez',
      email: 'cmartinez@email.com',
      phone: '3125550103',
      lob: LineOfBusiness.HEALTH,
      src: SourceChannel.COLD_CALL,
      temp: Temperature.COLD,
    },
    {
      first: 'Jennifer',
      last: 'Wilson',
      email: 'jwilson@email.com',
      phone: '3125550104',
      lob: LineOfBusiness.LIFE,
      src: SourceChannel.SOCIAL,
      temp: Temperature.HOT,
    },
    {
      first: 'Michael',
      last: 'Taylor',
      email: 'mtaylor@email.com',
      phone: '3125550105',
      lob: LineOfBusiness.PNC,
      src: SourceChannel.WEB_FORM,
      temp: Temperature.WARM,
    },
    {
      first: 'Patricia',
      last: 'Anderson',
      email: 'panderson@email.com',
      phone: '3125550106',
      lob: LineOfBusiness.HEALTH,
      src: SourceChannel.REFERRAL,
      temp: Temperature.HOT,
    },
    {
      first: 'David',
      last: 'Thomas',
      email: 'dthomas@email.com',
      phone: '3125550107',
      lob: LineOfBusiness.LIFE,
      src: SourceChannel.IMPORT,
      temp: Temperature.COLD,
    },
    {
      first: 'Barbara',
      last: 'Jackson',
      email: 'bjackson@email.com',
      phone: '3125550108',
      lob: LineOfBusiness.PNC,
      src: SourceChannel.WEB_FORM,
      temp: Temperature.WARM,
    },
    {
      first: 'James',
      last: 'White',
      email: 'jwhite@email.com',
      phone: '3125550109',
      lob: LineOfBusiness.HEALTH,
      src: SourceChannel.COLD_CALL,
      temp: Temperature.HOT,
    },
    {
      first: 'Susan',
      last: 'Harris',
      email: 'sharris@email.com',
      phone: '3125550110',
      lob: LineOfBusiness.LIFE,
      src: SourceChannel.SOCIAL,
      temp: Temperature.WARM,
    },
    {
      first: 'Richard',
      last: 'Martin',
      email: 'rmartin@email.com',
      phone: '3125550111',
      lob: LineOfBusiness.PNC,
      src: SourceChannel.REFERRAL,
      temp: Temperature.HOT,
    },
    {
      first: 'Margaret',
      last: 'Garcia',
      email: 'mgarcia@email.com',
      phone: '3125550112',
      lob: LineOfBusiness.HEALTH,
      src: SourceChannel.WEB_FORM,
      temp: Temperature.COLD,
    },
    {
      first: 'Joseph',
      last: 'Rodriguez',
      email: 'jrodriguez@email.com',
      phone: '3125550113',
      lob: LineOfBusiness.LIFE,
      src: SourceChannel.IMPORT,
      temp: Temperature.WARM,
    },
    {
      first: 'Dorothy',
      last: 'Lewis',
      email: 'dlewis@email.com',
      phone: '3125550114',
      lob: LineOfBusiness.PNC,
      src: SourceChannel.COLD_CALL,
      temp: Temperature.HOT,
    },
    {
      first: 'Thomas',
      last: 'Lee',
      email: 'tlee@email.com',
      phone: '3125550115',
      lob: LineOfBusiness.HEALTH,
      src: SourceChannel.SOCIAL,
      temp: Temperature.WARM,
    },
    {
      first: 'Nancy',
      last: 'Walker',
      email: 'nwalker@email.com',
      phone: '3125550116',
      lob: LineOfBusiness.LIFE,
      src: SourceChannel.REFERRAL,
      temp: Temperature.COLD,
    },
    {
      first: 'Charles',
      last: 'Hall',
      email: 'chall@email.com',
      phone: '3125550117',
      lob: LineOfBusiness.PNC,
      src: SourceChannel.WEB_FORM,
      temp: Temperature.HOT,
    },
    {
      first: 'Betty',
      last: 'Allen',
      email: 'ballen@email.com',
      phone: '3125550118',
      lob: LineOfBusiness.HEALTH,
      src: SourceChannel.IMPORT,
      temp: Temperature.WARM,
    },
    {
      first: 'Christopher',
      last: 'Young',
      email: 'cyoung@email.com',
      phone: '3125550119',
      lob: LineOfBusiness.LIFE,
      src: SourceChannel.COLD_CALL,
      temp: Temperature.HOT,
    },
    {
      first: 'Helen',
      last: 'Hernandez',
      email: 'hhernandez@email.com',
      phone: '3125550120',
      lob: LineOfBusiness.PNC,
      src: SourceChannel.SOCIAL,
      temp: Temperature.WARM,
    },
  ]

  const agents = [adminAgent, agent1, agent2]
  const stagePool = stages.slice(0, 5)

  for (let i = 0; i < contactData.length; i++) {
    const c = contactData[i]
    const assignedAgent = agents[i % 3]
    const stage = stagePool[i % stagePool.length]
    const phone = c.phone
    const phoneE164 = `+1${phone}`

    const contact = await db.contact.upsert({
      where: { id: `seed-contact-${i + 1}` },
      update: {},
      create: {
        id: `seed-contact-${i + 1}`,
        orgId: org.id,
        firstName: c.first,
        lastName: c.last,
        email: c.email,
        phone,
        phoneE164,
        sourceChannel: c.src,
        utmSource: c.src === SourceChannel.WEB_FORM ? 'google' : null,
        utmMedium: c.src === SourceChannel.WEB_FORM ? 'cpc' : null,
        utmCampaign: c.src === SourceChannel.WEB_FORM ? 'insurance-leads-2024' : null,
        assignedAgentId: assignedAgent.id,
      },
    })

    await db.lead.upsert({
      where: { id: `seed-lead-${i + 1}` },
      update: {},
      create: {
        id: `seed-lead-${i + 1}`,
        contactId: contact.id,
        pipelineStageId: stage.id,
        lineOfBusiness: c.lob,
        temperature: c.temp,
        rankScore: Math.round(Math.random() * 40 + 50),
        expectedRevenue: Math.round((Math.random() * 4000 + 500) * 100) / 100,
        closeDate: new Date(Date.now() + Math.random() * 90 * 24 * 3600 * 1000),
        lastActivityAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000),
      },
    })
  }

  console.log('Seed complete.')
  console.log(`  Org: ${org.name}`)
  console.log(
    `  Users: admin@apex-insurance.com / james@apex-insurance.com / mia@apex-insurance.com`
  )
  console.log(`  Password: Password123!`)
  console.log(`  Pipeline stages: ${stages.length}`)
  console.log(`  Contacts/Leads: ${contactData.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
