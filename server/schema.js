import * as _ from 'underscore';

import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLSchema,
  GraphQLString,
  GraphQLInt,
  GraphQLID,
  GraphQLFloat,
  GraphQLEnumType,
  GraphQLNonNull
} from 'graphql';

import {
  connectionArgs,
  connectionDefinitions,
  connectionFromArray,
  cursorForObjectInConnection,
  fromGlobalId,
  globalIdField,
  mutationWithClientMutationId,
  nodeDefinitions,
  toGlobalId,
} from 'graphql-relay';

import {
  getCollection
} from './database.js';

export class User extends Object {}
export class Author extends Object {}


// Mock authenticated ID.
const VIEWER_ID = 'me';


// Mock user data.
const viewer = new User();
viewer.id = VIEWER_ID;
const usersById = {
  [VIEWER_ID]: viewer,
};

export function getUser() {
  return usersById[VIEWER_ID];
}

export function getViewer() {
  return getUser(VIEWER_ID);
}

let postsCollection;
getCollection('posts').then((col) => {
  postsCollection = col;
})
let authorsCollection;
getCollection('authors').then((col) => {
  authorsCollection = col;
})
let commentsCollection;
getCollection('comments').then((col) => {
  commentsCollection = col;
})
// You can use any MONGO_URL here, whether it's locally or on cloud.
// const db = mongo('mongodb://admin:admin123@127.0.0.1:27017/mydb');
const getAuthor = (id) => {
  console.log('id', id, authorsCollection.findOne({id}))
  return authorsCollection.findOne({id});
}

const getAuthors = () => {
  return authorsCollection.find().toArray();
}

export async function addAuthor(name) {
  const author = new Author();
  console.log((await getAuthors()).length);
  Object.assign(author, {
    id: `${(await getAuthors()).length++}`,
    name,
  });
  authorsCollection.insert(author);
  return author.id;
}

export async function removeAuthor(id) {
  authorsCollection.remove({id});
}

const { nodeInterface, nodeField } = nodeDefinitions(
  globalId => {
    const { type, id } = fromGlobalId(globalId);
    if (type === 'Author') {
      return getAuthor(id);
    }
    if (type === 'Comment') {
      return getComment(id);
    }
    if (type === 'Post') {
      return getPost(id);
    }
    return null;
  },
  obj => {
    if (obj instanceof Author) {
      return GraphQLAuthor;
    }
    if (obj instanceof Comment) {
      return GraphQLComment;
    }
    if (obj instanceof Post) {
      return GraphQLPost;
    }
    return null;
  },
);

const Category = new GraphQLEnumType({
  name: 'Category',
  description: 'A Category of the blog',
  values: {
    NEWS: {value: 'news'},
    EVENT: {value: 'event'},
    USER_STORY: {value: 'user-story'},
    OTHER: {value: 'other'}
  }
});

const GraphQLAuthor = new GraphQLObjectType({
  name: 'Author',
  description: 'Represent the type of an author of a blog post or a comment',
  fields: {
    id: globalIdField(),
    name: {type: GraphQLString},
    twitterHandle: {type: GraphQLString}
  },
  interfaces: [nodeInterface]
});

const { connectionType: AuthorsConnection, edgeType: GraphQLAuthorEdge } =
  connectionDefinitions({ nodeType: GraphQLAuthor });

const GraphQLUser = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: globalIdField(),
    authors: {
      type: AuthorsConnection,
      args: {
        ...connectionArgs,
      },
      resolve: async (obj, args) => (
        connectionFromArray(await getAuthors(), args)
      ),
    },
  },
  interfaces: [nodeInterface],
});

const GraphQLRoot = new GraphQLObjectType({
  name: 'Root',
  fields: {
    viewer: {
      type: GraphQLUser,
      resolve: getViewer,
    },
    node: nodeField,
  },
});

const GraphQLAddAuthorMutation = mutationWithClientMutationId({
  name: 'AddAuthor',
  inputFields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
  outputFields: {
    viewer: {
      type: GraphQLUser,
      resolve: getViewer,
    },
    authorEdge: {
      type: GraphQLAuthorEdge,
      resolve: async ({ authorId }) => {
        console.log('authorId', authorId);
        const author = await getAuthor(authorId);
        console.log('authorId', authorId, author);
        return {
          cursor: cursorForObjectInConnection(await getAuthors(), author),
          node: author,
        };
      },
    },
  },
  mutateAndGetPayload: async ({ name }) => {
    const authorId = await addAuthor(name);
    return { authorId };
  },
});

const GraphQLRemoveAuthorMutation = mutationWithClientMutationId({
  name: 'RemoveAuthor',
  inputFields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
  },
  outputFields: {
    viewer: {
      type: GraphQLUser,
      resolve: getViewer,
    },
    deletedId: {
      type: GraphQLID,
      resolve: ({ id }) => id,
    },
  },
  mutateAndGetPayload: ({ id }) => {
    const { id: authorId } = fromGlobalId(id);
    removeAuthor(authorId);
    return { id };
  },
});

const GraphQLMutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    addAuthor: GraphQLAddAuthorMutation,
    removeAuthor: GraphQLRemoveAuthorMutation,
  },
});

const Schema = new GraphQLSchema({
  query: GraphQLRoot,
  mutation: GraphQLMutation,
});

// const HasAuthor = new GraphQLInterfaceType({
//   name: 'HasAuthor',
//   description: 'This type has an author',
//   fields: () => ({
//     author: {type: Author}
//   }),
//   resolveType: (obj) => {
//     if(obj.title) {
//       return Post;
//     } else if(obj.replies) {
//       return Comment;
//     } else {
//       return null;
//     }
//   }
// });

// const Comment = new GraphQLObjectType({
//   name: 'Comment',
//   interfaces: [HasAuthor],
//   description: 'Represent the type of a comment',
//   fields: () => ({
//     _id: {type: GraphQLString},
//     content: {type: GraphQLString},
//     author: {
//       type: Author,
//       resolve: getAuthor
//     },
//     timestamp: {type: GraphQLFloat},
//     replies: {
//       type: new GraphQLList(Comment),
//       description: 'Replies for the comment',
//       resolve: getComments
//     }
//   })
// });

// const getComments = () => {
//   return commentsCollection.find().toArray();
// }

// const getComment = (id) => {
//   return commentsCollection.findOne(id);
// }

// const Post = new GraphQLObjectType({
//   name: 'Post',
//   interfaces: [HasAuthor],
//   description: 'Represent the type of a blog post',
//   fields: () => ({
//     _id: {type: GraphQLString},
//     title: {type: GraphQLString},
//     category: {type: Category},
//     summary: {type: GraphQLString},
//     content: {type: GraphQLString},
//     timestamp: {
//       type: GraphQLFloat,
//       resolve: function(post) {
//         if(post.date) {
//           return new Date(post.date['date']).getTime();
//         } else {
//           return null;
//         }
//       }
//     },
//     comments: {
//       type: new GraphQLList(Comment),
//       args: {
//         limit: {type: GraphQLInt, description: 'Limit the comments returing'}
//       },
//       resolve: getComments
//     },
//     author: {
//       type: Author,
//       resolve: function({author}) {
//         return getAuthor({_id:author});
//       }
//     }
//   })
// });

// const getPosts = () => {
//   return postsCollection.find().sort({timestamp:1}).toArray();
// }
// const getPost = (id) => {
//   return postsCollection.findOne(id);
// }

// const Query = new GraphQLObjectType({
//   name: 'RootQuery',
//   fields: {
//     posts: {
//       type: new GraphQLList(Post),
//       description: 'List of posts in the blog',
//       args: {
//         category: {type: Category}
//       },
//       resolve: function(source, {category}) {
//         if(category) {
//           return _.filter(getPosts(), post => post.category === category);
//         } else {
//           return getPosts();
//         }
//       }
//     },

//     latestPost: {
//       type: Post,
//       description: 'Latest post in the blog',
//       resolve: function() {
//         return getPosts().then(posts => {
//           return posts[0];
//         });
//       }
//     },

//     recentPosts: {
//       type: new GraphQLList(Post),
//       description: 'Recent posts in the blog',
//       args: {
//         count: {type: new GraphQLNonNull(GraphQLInt), description: 'Number of recent items'}
//       },
//       resolve: function(source, {count}) {
//         return getPosts().then(posts => {
//           return posts.slice(0, count);
//         });
//       }
//     },

//     post: {
//       type: Post,
//       description: 'Post by _id',
//       args: {
//         _id: {type: new GraphQLNonNull(GraphQLString)}
//       },
//       resolve: function(source, {_id}) {
//         return _.filter(getPosts(), post => post._id === _id)[0];
//       }
//     },
//     authors: {
//       type: new GraphQLList(Author),
//       resolve: function(rootValue, args, info) {
//         let fields = {};
//         let fieldASTs = info.fieldASTs;
//         fieldASTs[0].selectionSet.selections.map(function(selection) {
//           fields[selection.name.value] = 1;
//         });
//         return getAuthors(fields);
//       }
//     },
//     author: {
//       type: Author, 
//       args: { 
//         _id: { type: GraphQLString}
//       },
//       resolve: function(rootValue, {_id}) {
//         return getAuthor({_id});
//       }
//     },
//   }
// });

// const Mutation = new GraphQLObjectType({
//   name: 'Mutations',
//   fields: {
//     createPost: {
//       type: Post,
//       description: 'Create a new blog post',
//       args: {
//         _id: {type: new GraphQLNonNull(GraphQLString)},
//         title: {type: new GraphQLNonNull(GraphQLString)},
//         content: {type: new GraphQLNonNull(GraphQLString)},
//         summary: {type: GraphQLString},
//         category: {type: Category},
//         author: {type: new GraphQLNonNull(GraphQLString), description: 'Id of the author'}
//       },
//       resolve: function(source, {...args}) {
//         let post = args;
//         let alreadyExists = _.findIndex(getPosts(), p => p._id === post._id) >= 0;
//         if(alreadyExists) {
//           throw new Error('Post already exists: ' + post._id);
//         }
//         alreadyExists = _.findIndex(getAuthors(), p => p._id === post.author) >= 0;
//         if(alreadyExists) {
//           throw new Error('No such author: ' + post.author);
//         }

//         if(!post.summary) {
//           post.summary = post.content.substring(0, 100);
//         }

//         post.comments = [];
//         post.date = {date: new Date().toString()}

//         return postsCollection.insert(post)
//           .then(_=> post);
//       }
//     },
//     createAuthor: {
//       type: Author,
//       args: {
//         _id: {type: new GraphQLNonNull(GraphQLString)},
//         name: {type: new GraphQLNonNull(GraphQLString)},
//         twitterHandle: {type: GraphQLString}
//       },
//       resolve: function(rootValue, args) {
//         let author = Object.assign({}, args);
//         return authorsCollection.insert(author)
//           .then(_ => author);
//       }
//     }
//   }
// });

// const Schema = new GraphQLSchema({
//   query: Query,
//   mutation: Mutation
// });
export default Schema;
