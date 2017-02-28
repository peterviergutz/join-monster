import {
  GraphQLObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean
} from 'graphql'

import knex from './database'
import dbCall from '../data/fetch'

import User from './User'
import Sponsor from './Sponsor'
import { fromBase64 } from './utils'

import joinMonster from '../../src/index'
const options = {
  dialect: 'oracle',
  minify: process.env.MINIFY == 1
}
if (knex.client.config.client === 'mysql') {
  options.dialect = 'mysql'
} else if (knex.client.config.client === 'pg') {
  options.dialect = 'pg'
}


export default new GraphQLObjectType({
  description: 'global query object',
  name: 'Query',
  fields: () => ({
    version: {
      type: GraphQLString,
      resolve: () => joinMonster.version
    },
    database: {
      type: GraphQLString,
      resolve: () => knex.client.config.client + ' ' + JSON.stringify(knex.client.config.connection).replace(/"/g, '  ')
    },
    users: {
      type: new GraphQLList(User),
      args: {
        ids: { type: new GraphQLList(GraphQLInt) }
      },
      where: (table, args) => args.ids ? `${table}.id IN (${args.ids.join(',')})` : null,
      resolve: async (parent, args, context, resolveInfo) => {
        const users = await joinMonster(resolveInfo, context, sql => dbCall(sql, knex, context), options)
        return users.sort((a, b) => a.id - b.id)
      }
    },
    user: {
      type: User,
      args: {
        id: {
          description: 'The users ID number',
          type: GraphQLInt
        },
        idEncoded: {
          description: 'The users encoded ID number',
          type: GraphQLString
        },
        idAsync: {
          description: 'The users ID number, with an async where function',
          type: GraphQLInt
        }
      },
      where: (usersTable, args, context) => { // eslint-disable-line no-unused-vars
        if (args.id) return `${usersTable}."id" = ${args.id}`
        if (args.idEncoded) return `${usersTable}."id" = ${fromBase64(args.idEncoded)}`
        if (args.idAsync) return Promise.resolve(`${usersTable}."id" = ${args.idAsync}`)
      },
      resolve: (parent, args, context, resolveInfo) => {
        return joinMonster(resolveInfo, context, sql => dbCall(sql, knex, context), options)
      }
    },
    sponsors: {
      type: new GraphQLList(Sponsor),
      args: {
        filterLegless: {
          description: 'Exclude sponsors with no leg info',
          type: GraphQLBoolean
        }
      },
      where: (sponsorsTable, args, context) => { // eslint-disable-line no-unused-vars
        if (args.filterLegless) return `${sponsorsTable}.num_legs IS NULL`
      },
      resolve: (parent, args, context, resolveInfo) => {
        // use the callback version this time
        return joinMonster(resolveInfo, context, (sql, done) => {
          knex.raw(sql)
          .then(result => {
            if (options.dialect === 'mysql') {
              done(null, result[0])
            } else {
              done(null, result)
            }
          })
          .catch(done)
        }, options)
      }
    }
  })
})

