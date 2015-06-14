
Format of join
---

var changes = db.collection( // CAN LEAD TO CONFUSING MIXTURE OF join and left_joins
  ['objs', 'docs', 'attrs'],
  [ ['join', 'docs.obj_id', 'objs.id'], ['left_join', 'attrs.doc_id', 'docs.id'] ]);
OR
var changes = db.collection({ // CAN LEAD TO CONFUSING MIXTURE OF join and left_joins
  docs: { join: { obj_id: 'objs.id' } }
  attrs: { join: { doc_id: 'docs.id' } }
});
OR
var changes = db.collection({
  joins: {
    docs: { obj_id: 'objs.id' }
  },
  left_joins: {
    attrs: { doc_id: 'docs.id' }
  }
});
OR
var changes = db.join({
  joins: [
    ['docs.obj_id', 'objs.id']
  ],
  left_joins: [
    ['attrs.doc_id', 'docs.id']
  ]
});
OR
var changes = db.join({ // YES!!!!!
  joins: {
    docs: [ ['docs.obj_id', '=', 'objs.id'], 'or' , ['doc.user_id', '=', '?'] ],
    users: [ ['users.user_id', '=', 'docs.id'], 'and' , ['doc.user_id', '=', '?'] ]
  },
  left_joins: {
    attrs: ['attrs.doc_id', '=', 'docs.id']
  }
});


Format of where
---

e.g. ['age', '<', '"33"'] - YES!!
OR
e.g. ['{age}', '<', '33'] - NO as '{' can be in literal string
OR
e.g. [ { name: 'age' }, '<', { value: '33' }] - NO, too verbose