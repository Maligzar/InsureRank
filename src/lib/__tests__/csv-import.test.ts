import { describe, it, expect } from 'vitest'
import { parseCsvContacts } from '../csv-import'

const VALID_CSV = `firstName,lastName,email,phone,sourceChannel,lineOfBusiness,expectedRevenue
Jane,Doe,jane@test.com,+15550001111,REFERRAL,LIFE,5000
John,Smith,john@test.com,,IMPORT,PNC,
`

const ALIAS_CSV = `first_name,last_name,e_mail,source,lob
Alice,Brown,alice@test.com,COLD_CALL,HEALTH
`

describe('parseCsvContacts', () => {
  it('parses valid rows', () => {
    const { rows, errors } = parseCsvContacts(VALID_CSV)
    expect(rows).toHaveLength(2)
    expect(errors).toHaveLength(0)
    expect(rows[0].firstName).toBe('Jane')
    expect(rows[0].lineOfBusiness).toBe('LIFE')
    expect(rows[0].expectedRevenue).toBe(5000)
  })

  it('accepts column name aliases', () => {
    const { rows, errors } = parseCsvContacts(ALIAS_CSV)
    expect(errors).toHaveLength(0)
    expect(rows[0].firstName).toBe('Alice')
    expect(rows[0].sourceChannel).toBe('COLD_CALL')
    expect(rows[0].lineOfBusiness).toBe('HEALTH')
  })

  it('defaults sourceChannel to IMPORT when missing', () => {
    const csv = `firstName,lastName\nBob,Lee\n`
    const { rows } = parseCsvContacts(csv)
    expect(rows[0].sourceChannel).toBe('IMPORT')
  })

  it('returns errors for rows with missing required fields', () => {
    const csv = `firstName,lastName\n,Lee\nBob,\n`
    const { rows, errors } = parseCsvContacts(csv)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(2)
    expect(errors[0].row).toBe(2)
  })

  it('returns errors for invalid email', () => {
    const csv = `firstName,lastName,email\nJane,Doe,not-an-email\n`
    const { errors } = parseCsvContacts(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('email')
  })

  it('rejects invalid lineOfBusiness value', () => {
    const csv = `firstName,lastName,lineOfBusiness\nJane,Doe,AUTO\n`
    const { errors } = parseCsvContacts(csv)
    expect(errors).toHaveLength(1)
  })

  it('handles empty CSV', () => {
    const { rows, errors } = parseCsvContacts('')
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('skips empty lines', () => {
    const csv = `firstName,lastName\nJane,Doe\n\n\nBob,Smith\n`
    const { rows } = parseCsvContacts(csv)
    expect(rows).toHaveLength(2)
  })

  it('coerces expectedRevenue from string', () => {
    const csv = `firstName,lastName,expectedRevenue\nJane,Doe,12500\n`
    const { rows } = parseCsvContacts(csv)
    expect(rows[0].expectedRevenue).toBe(12500)
  })

  it('rejects negative expectedRevenue', () => {
    const csv = `firstName,lastName,expectedRevenue\nJane,Doe,-100\n`
    const { errors } = parseCsvContacts(csv)
    expect(errors).toHaveLength(1)
  })
})
