﻿var Url = require('./../model/url.model');
var successMessage = require('./../services/successMessage');
var failMessage = require('./../services/failMessage');

module.exports = {
  createUrl: createUrl,
  getAllUrl: getAllUrl,
  getUrlById: getUrlById,
  updateUrl: updateUrl,
  deleteUrl: deleteUrl,
  addPathInUrl: addPathInUrl,
  removePathInUrl: removePathInUrl,
  addCategory: addCategory,
  removeCategory: removeCategory
};

function addCategory(request) {
  return Url.findById({
    _id: request.id
  }).then(w => {
    w.path.forEach(item => {
      if (item._id == request.object) {
        item.catelogyId = request.cateId;
        w.save().then(function (res) {
          return Promise.resolve(res);
        });
      }
    })
  }).catch(w => {
    return Promise.reject(res);
  })
}

function removeCategory(request) {
  return Url.findById({
    _id: request.id
  }).then(w => {
    w.path.forEach(item => {
      if (item._id == request.object) {
        item.catelogyId = null;
        w.save().then(function (res) {
          return Promise.resolve(res);
        });
      }
    })
  }).catch(w => {
    return Promise.reject(res);
  })
}

function removePathInUrl(request) {
  return Url.update({
    _id: request.id
  }, {
    $pull: {
      'path': {
        namePath: request.namePath
      }
    }
  }).then(function (res) {
    return Promise.resolve(res);
  }).catch(function (err) {
    return Promise.reject(err);
  })
}

function addPathInUrl(request) {
  var newPath = {
    "namePath": request.namePath
  }
  return Url.findById({
    _id: request.id
  }).then(w => {
    w.update({
      $push: {
        path: newPath
      }
    }).then(function (res) {
      return Promise.resolve(res);
    }).catch(function (err) {
      return Promise.reject(err);
    })
  }).catch(w => {
    return Promise.reject();
  })
}

function createUrl(request) {
  var newUrl = new Url({
    title: request.title,
    hostname: request.hostname,
    path: request.path
  });
  return Url.findOne({
      hostname: request.hostname
    }).exec()
    .then(function (url) {
      if (url != null) {
        return Promise.reject({
          message: failMessage.url.dupplicate
        });
      }
      return newUrl.save().then(function (err) {
        return Promise.resolve({
          message: successMessage.url.create
        });
      });
    });
}

function getAllUrl() {
  return Url.find().exec()
    .then(function (urls) {
      if (urls.length === 0) {
        return Promise.reject({
          message: failMessage.url.notFound
        });
      }
      return Promise.resolve({
        message: successMessage.url.getAll,
        urls: urls
      });
    });
}

function getUrlById(request) {
  return Url.findOne({
    _id: request.id
  }).exec().then(function (url) {
    if (url === null) {
      return Promise.reject({
        message: failMessage.url.notFound
      });
    }
    return Promise.resolve({
      message: successMessage.url.get,
      url: url
    });
  });
}

function updateUrl(request) {
  return Url.findById({
    _id: request.id
  }).exec().then(function (url) {
    if (url === null) {
      return Promise.reject({
        message: failMessage.url.notFound
      });
    }

    if (request.title !== undefined && request.title !== '') {
      url.title = request.title;
    }
    if (request.hostname !== undefined && request.hostname !== '') {
      url.hostname = request.hostname;
    }
    if (request.path !== undefined && request.path.length !== 0) {
      url.path = request.path;
    }
    return Url.findOne({
      _id: {
        $ne: request.id
      },
      hostname: url.hostname
    }).exec().then(function (urls) {
      if (urls === null) {
        return url.save().then(function () {
          return Promise.resolve({
            message: successMessage.url.update,
            url: url
          });
        });
      }
      return Promise.reject({
        message: failMessage.url.dupplicate
      });
    });
  })
}

function deleteUrl(request) {
  return Url.findByIdAndRemove({
    _id: request.id
  }).exec().then(function (err) {
    if (!err) {
      return Promise.reject({
        message: failMessage.url.notFound
      });
    }
    return Promise.resolve({
      message: successMessage.url.delete
    });
  });
}
