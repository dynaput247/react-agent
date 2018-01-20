const { Agent } = require('../react-agent');
const { run } = require('../react-agent');
const { emit } = require('../react-agent');
const { on } = require('../react-agent');
const { subscribe } = require('../react-agent');
const React = require('../react-agent/node_modules/react');
const { render } = require('react-dom');
const agent = require('./../react-agent-server');
const express = require('express');
const pg = require('pg');
const chai = require('chai');
const jsdom = require('jsdom');
const fetch = require('request');

/*eslint-disable*/

const { JSDOM } = jsdom;
const should = chai.should();
const app = express();

const uri = 'postgres://nupdilwa:wKwvHTFrRlqfKgJAQ5088RaCIhDJLHz5@nutty-custard-apple.db.elephantsql.com:5432/nupdilwa';

const client = new pg.Client(uri);
client.connect();

describe('React Agent Server', () => {
  const db = {
    name: 'nupdilwa',
    user: 'nupdilwa',
    password: 'wKwvHTFrRlqfKgJAQ5088RaCIhDJLHz5',
    dialect: 'postgres',
    host: 'nutty-custard-apple.db.elephantsql.com',
    port: 5432,
  };

  let actions;
  const  messages = [];

  before(() => {
    client.query(`CREATE TABLE classes(
      name VARCHAR(100),
      department VARCHAR(100),
      id SERIAL PRIMARY KEY
      )`);

    client.query(`CREATE TABLE students(
    name VARCHAR(255),
    major VARCHAR(255),
    classyr INTEGER,
    id SERIAL PRIMARY KEY
    )`);

    client.query(`CREATE TABLE classes_students(
      class_id SERIAL,
      student_id SERIAL,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )`);

    client.query(`INSERT INTO classes(name, department) VALUES
    ('Intro to Sociology', 'Sociology'),
    ('Examining Gender in the 21st C.', 'Gender Studies'),
    ('Algorithms', 'Computer Science'),
    ('Contemporary Art', 'Art History'),
    ('Formal Language and State Automata', 'Computer Science'),
    ('Social Theory', 'Sociology'),
    ('Graph Theory', 'Mathematics'),
    ('Jewish, Christian, and Islamic Investigations', 'Religion'),
    ('Property Law', 'Legal Studies'),
    ('Intro to Algebra', 'Mathematics'),
    ('Intellectual Property Law', 'Legal Studies'),
    ('Privacy and Hacking', 'Digital Humanities'),
    ('Advanced Terrorism', 'International Relations')`);

    client.query(`INSERT INTO students(name, major, classyr) VALUES
    ('Tom', 'Art History', 2016),
    ('Henry', 'Computer Science', 2016),
    ('Tiffany', 'Computer Science', 2008),
    ('Andrew', 'International Relations', 2019),
    ('Eric', 'Legal Studies', 2010),
    ('Althea', 'Religion', 2016),
    ('Monica', 'Art History', 2010),
    ('Mike', 'Sociology', 2010),
    ('Peter', 'Digital Humanities', 2017),
    ('Justin', 'Mathematics', 2017),
    ('Jaimie', 'International Relations', 2006),
    ('Annie', 'Computer Science', 2019),
    ('Dale', 'Computer Science', 2005),
    ('Erik', 'Gender Studies', 2011)`);

    client.query(`INSERT INTO classes_students(class_id, student_id) VALUES
    (1, 13),
    (3, 11),
    (1, 6),
    (5, 8),
    (6, 4),
    (3, 9),
    (4, 5),
    (10, 7),
    (9, 11),
    (6, 3),
    (2, 10),
    (11, 4),
    (5, 1),
    (6, 7),
    (8, 8),
    (7, 3),
    (6, 6)`);

    const dom = new JSDOM('<!DOCTYPE html><div id=\'root\'></div>');

    render(
      <Agent testing>
        <div>
          React Agent
        </div>
      </Agent>
      , dom.window.document.querySelector('#root'),
    );

    const server = app.listen(3003);

    actions = {
      getStudentClasses: {
        pre: request => false,
        action: 'SELECT s.name, c.name FROM students s INNER JOIN classes_students cs on s.id = cs.student_id INNER JOIN classes c on c.id = cs.class_id',
      },
      getStudents: {
        pre: [
          (request) => {
            if (request.test === 'test') return request;
            return false;
          },
          () => false,
        ],
        action: 'SELECT s.name, c.name FROM students s INNER JOIN classes_students cs on s.id = cs.student_id INNER JOIN classes c on c.id = cs.class_id',
      },
      getClasses: {
        pre: [
          (request) => {
            if (request) return request;
            return false;
          },
          (request) => {
            if (request.test === 'test') return request;
            return false;
          }],
        action: `SELECT name FROM students WHERE id = 3`,
        callback: response => {
          return response[0][0].name;
        }
      },
      getStudentsInTwoClasses: {
        action: 'SELECT s.name FROM students s INNER JOIN classes_students cs on s.id = cs.student_id INNER JOIN classes c on c.id = cs.class_id WHERE c.name = $class1 OR c.name = $class2',
        callback: response => {
          const names = {names: []};
          response[0].forEach(x => {
            names.names.push(x.name);
          })
          console.log('NAMES', names)
          return names;
        }
      },
      getImage: {
          action: (resolve, reject, body) => {
          fetch(body.url, (error, response, body) => {
            if(error) reject(error);
            else resolve('success');
          })
        }
      },
    };

    const loggingFunc = (message) => {
      console.log(message);
      messages.push(message);
    };

    agent(server, actions, db, loggingFunc);
  });


  after(() => {
    client.query('DROP TABLE classes, students, classes_students');
  });

  describe('pre', function () {
    this.timeout(3000);

    it('should return error if a function returns false', (done) => {

      run('getStudentClasses', { test: 'test' }).catch((err) => {
        err.should.equal('React Agent: Not all server pre functions passed.');
        done();
      });
    });

    it('should return error if one out of multiple functions returns false', (done) => {

      run('getStudents', { test: 'test' }).catch((err) => {
        err.should.equal('React Agent: Not all server pre functions passed.');
        done();
      });
    });

    it('should run action if no functions returns false', (done) => {

      run('getClasses', { test: 'test' })
        .then((data) => {
          data.should.equal('Tiffany');
          done();
        });
    });

  });

  describe('action', () => {
    it('should execute SQL command with ? replacement', (done) => {

      run('getStudentsInTwoClasses', { class1: 'Algorithms', class2: 'Examining Gender in the 21st C.' })
        .then( data => {
          data.names.should.deep.equal([ 'Jaimie', 'Peter', 'Justin' ]);
          done();
        })
    })

    it('should resolve non-SQL functions', (done) => {

      run('getImage', { url: 'https://raw.githubusercontent.com/yokyak/react-agent/master/docs/imgs/diagram-after.gif' })
        .then(data => {
          data.should.equal('success');
          done();
        })
    });
  });

  describe('callback', () => {
    it('should execute with response from action', (done) => {

    });

    it('should send response to client', (done) => {

    });
  });

  describe('errorMessage', () => {

    it('should send default error to client', (done) => {
      actions = {
        addStudent: {
          action: `INSERT INTO studens VALUES(?, ?)`
        }
      };
    });

    it('should overwrite default error message', (done) => {
      actions = {
        addStudent: {
          action: `INSERT INTO studens VALUES(?, ?)`,
          error: `Student entry error for action 'addStudent'`
        }
      };
    });
  });

  describe('logger', () => {

    it('should log key, actionID, client object, pre, and completed', (done) => {

    });

    it('should log errors', (done) => {

    })

  });
});

