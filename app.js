const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
//Initialize server and db
let db = null
const initalizeServerAndDb = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server Started...')
    })
  } catch (err) {
    console.log(`DB error:${err.message}`)
    process.exit(1)
  }
}
initalizeServerAndDb()

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
const convertToStateCamelCase = item => {
  return {
    stateId: item.state_id,
    stateName: item.state_name,
    population: item.population,
  }
}
const convertToDistrictCamelCase = item => {
  return {
    districtId: item.district_id,
    districtName: item.district_name,
    stateId: item.state_id,
    cases: item.cases,
    cured: item.cured,
    active: item.active,
    deaths: item.deaths,
  }
}

//API-1 =>Login
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectedQuery = `SELECT * FROM user WHERE username = "${username}";`
  const dbUser = await db.get(selectedQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send(`jwtToken: ${jwtToken}`)
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

//API-2

app.get('/states/', authenticateToken, async (request, response) => {
  const getSelectedQuery = `
  SELECT *
  FROM state;
  `
  const dbResponse = await db.all(getSelectedQuery)
  response.send(dbResponse.map(each => convertToStateCamelCase(each)))
})

//API-3

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getQuery = `
  SELECT *
  FROM state
  WHERE state_id = ${stateId};
  `
  const dbResponse = await db.get(getQuery)
  response.send(convertToStateCamelCase(dbResponse))
})

//API-4 =>POST districts

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const getQuery = `
  INSERT INTO 
    district(district_name,state_id,cases,cured,active,deaths)
  VALUES
    (
      ${stateId},"${districtName}",${cases},${cured},${active},${deaths}
    );
  `
  const data = await db.run(getQuery)
  response.send('District Successfully Added')
})

//API-5 get distict specified
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistQuery = `
  SELECT * FROM district WHERE district_id = ${districtId};
  `
    const data = await db.get(getDistQuery)
    response.send(convertToDistrictCamelCase(data))
  },
)
//API-6 delete specified district
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `
  DELETE FROM district WHERE district_id= ${districtId};
  `
    const data = await db.run(deleteQuery)
    response.send('District Removed')
  },
)
//API-7 update specified district
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const {districtId} = request.params
    const updateQuery = `
  UPDATE district
  SET 
    district_name = '${districtName}',
    state_id =${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};
  `
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)
//API-8 get stats of states
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateQuery = `
  SELECT 
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
  FROM 
    district
  WHERE
    state_id = ${stateId};
  `
    const data = await db.get(getStateQuery)
    response.send(data)
  },
)

module.exports = app
