var request = require("request");
var cheerio = require("cheerio");
var Spider = require('../dao/spider.dao');
var newsDao = require('../dao/news.dao');
var News = require('./../model/news.model');
var SpiderModel = require('./../model/spider.model');
var async = require('async');
var restrictDao = require('./../dao/restrict.dao');
var UrlModel = require('./../model/url.model');

module.exports = {
  spiderCountUpdateAll: spiderCountUpdateAll,

  spiderKhuyenNong: spiderKhuyenNong,
  spiderKhuyenNongUpdateAll: spiderKhuyenNongUpdateAll,
  spiderKhuyenNongPath: spiderKhuyenNongPath,
  spiderKhuyenNongUpdatePath: spiderKhuyenNongUpdatePath,
  spiderKhuyenNongUrl: spiderKhuyenNongUrl,
  spiderKhuyenNongUpdateUrl: spiderKhuyenNongUpdateUrl,
  spiderKhuyenNongUpdateUrlVersion2: spiderKhuyenNongUpdateUrlVersion2,
  getPathKhuyenNong: getPathKhuyenNong,
  getPathUpdateKhuyenNong: getPathUpdateKhuyenNong,

  checkRestrictedKey: checkRestrictedKey
}

function spiderCountUpdateAll(crawlingName) {
  return SpiderModel.findOne({
      crawlingName: crawlingName
    })
    .populate('urlId')
    .exec()
    .then(function (spiderN) {
      if (spiderN === null) {
        message: failMessage.spider.notFound
      }
      var count = 0;
      var list_length = spiderN.urlId.path.length;
      var list_news = [];
      return new Promise(function (resolve, reject) {
        async.series({
          list_news: function (callback) {
            async.whilst(function () {
              return count < list_length
            }, function (next) {
              return News.find({
                  categoryId: spiderN.urlId.path[count].catelogyId,
                  active: false,
                  $or: [{
                    title: undefined
                  }, {
                    title: ""
                  }, {
                    content: undefined
                  }, {
                    author: undefined
                  }, {
                    author: ""
                  }, {
                    createDate: undefined
                  }, {
                    createDate: ""
                  }]
                })
                .exec().then(function (upNews) {
                  var index = 0;
                  async.whilst(function () {
                    return index < upNews.length
                  }, function (callback2) {
                    var check = list_news.find(o => o.originalLink === upNews[index].originalLink);
                    if (check === undefined) {
                      list_news.push(upNews[index]);
                    }
                    index++;
                    callback2();
                  }, function (err) {
                    count++;
                    next();
                  });
                });
            }, function (err) {
              callback(null, list_news);
            });
          }
        }, function (err, result) {
          return resolve({
            length: list_news.length,
            list: list_news
          });
        })
      });
    });
}

function checkRestrictedKey(id, value) {
  return new Promise(function (resolve, reject) {
    return News.findById({
      _id: id
    }).exec().then(news => {
      return restrictDao.getAllRestrict().then(list => {
        var index = 0;
        news.restrictedKey = [];
        news.save().then(x => {
          list.forEach(item => {
            var temp = value;
            var count = 0;
            var t = new Promise(function (resolve, reject) {
              while (true) {
                if (temp.toLowerCase().indexOf(item.name.toLowerCase()) === -1) {
                  resolve(count);
                  break;
                } else {
                  count++;
                  temp = temp.substring(temp.toLowerCase().indexOf(item.name.toLowerCase()) + item.name.length);
                }
              }
            });
            t.then(res => {
              console.log(item.name + " " + res);
              var p = new Promise(function (resolve, reject) {
                var j = 0;
                news.restrictedKey.forEach(x => {
                  console.log(x);
                  if (x.name == item.name) {
                    resolve(true);
                  }
                  j++;
                  if (j == news.restrictedKey.length - 1) {
                    resolve(false);
                  }
                });
                if (news.restrictedKey.length === 0) {
                  resolve(false);
                }
              });
              p.then(check => {
                if (check == false) {
                  if (res !== 0) {
                    temp = value;
                    var request = {
                      id: news._id,
                      name: item.name,
                      count: res
                    };
                    News.findById({
                      _id: request.id
                    }).exec().then(news => {
                      news.restrictedKey.push({
                        restrict: request.name,
                        duplicate: request.count
                      });
                      news.save();
                    })
                  }
                }
                index++;
                if (index === list.length) {
                  return resolve(true);
                }
              })
            });
          });
        });
      });
    });
  });
}

//spiderKhuyenNong
function spiderKhuyenNong(urlId, spiderId) {
  return new Promise(function (resolve, reject) {
    var page = 0;

    async.whilst(function () {
        return page < urlId.path.length;
      },
      function (next) {
        var disUrl = urlId.hostname + urlId.path[page].namePath;
        console.log(disUrl);
        console.log(urlId.path[page]);
        getPathKhuyenNong(disUrl, spiderId, urlId.path[page].catelogyId).then(function (res) {
          page++;
          console.log(page);
          next();
        }).catch(function (err) {
          console.log(err);
        });

      },
      function (err) {
        return resolve("CALL_SUCCESS");
      });
  });
}

//getPathKhuyenNong
function getPathKhuyenNong(path, spiderId, catelogyId) {
  return new Promise(function (resolve, reject) {
    if (path === undefined) {
      return resolve(true);
    }
    var total = 0;
    var arrayNews = [];
    var orgi = path;
    SpiderModel.findById({
      _id: spiderId
    }).then(spider => {
      UrlModel.findById({
        _id: spider.urlId
      }).then(urlHost => {
        async.whilst(function () {
            return path !== undefined
          }, function (next) {
            async.series({
                gotoPage: function (callback) {
                  request(path, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                      var $ = cheerio.load(body);
                      let i = 1;
                      var length = $('.contentx .xitem').length;
                      if (length === 0) {
                        resolve(true);
                      }
                      var temp = new Promise(function (resolve, reject) {
                        $('.contentx .xitem').each(function () {
                          if (length == 0 || length == undefined) {
                            resolve(true);
                          }
                          url = urlHost.hostname + $('div.contentx > div:nth-child(' + i + ') > h2 > a').attr('href');
                          image = urlHost.hostname + $('div.contentx > div:nth-child(' + i + ') > a > img').attr('src');
                          des = $('div.contentx > div:nth-child(' + i + ') > span').text();
                          if (image === undefined) {
                            image = null;
                          }
                          var news = new News({
                            originalLink: url,
                            spiderId: spiderId,
                            categoryId: catelogyId,
                            image: image,
                            description: des,
                            active: false,
                            updateDate: Date.now()
                          });
                          News.findOne({
                            originalLink: news.originalLink
                          }, function (err, New) {
                            if (New === null) {
                              console.log(news.originalLink + " " + total);
                              if (news.originalLink === undefined || news.originalLink === '') {
                                resolve(true);
                              }
                              total++;
                              if (total === 200) {
                                resolve(true);
                              }
                              arrayNews.push(news._id);
                              news.save().then(function () {
                                resolve(true);
                              })
                            }
                          });
                          i++;
                          if (i == length) {
                            resolve(true);
                          }
                        });
                      });
                      temp.then(function (res) {
                        var gotoPage = urlHost.hostname + $('#dnn_ctr530_Main_UserNewsCategory__UserPagger_nextx').attr('href');
                        if (gotoPage === undefined) {
                          return resolve({
                            'total': total,
                            'listNewsId': arrayNews,
                            'status': true
                          });
                        }
                        if (total >= 10) {
                          return resolve({
                            'total': total,
                            'listNewsId': arrayNews,
                            'status': true
                          });
                        }
                        callback(null, gotoPage);
                      })
                    } else {
                      return reject(false);
                    }
                  });
                }
              },
              function (err, result) {
                path = result.gotoPage;
                next();
              });
          },
          function (err) {
            return resolve(true);
          })
      });
    });

  });
}

//spiderNongNghiepPath
function spiderKhuyenNongPath(urlId, spiderId, catelogyId) {
  urlId.path.forEach(url => {
    if (url.catelogyId.equals(catelogyId)) {
      var disUrl = urlId.hostname + url.namePath;
      getPathKhuyenNong(disUrl, spiderId, url.catelogyId);
    }
  });
}

//spiderKhuyenNongUrl
function spiderKhuyenNongUrl(urlId, spiderId, url) {
  News.findOne({
    originalLink: url
  }, function (err, tNews) {
    if (tNews !== null) {
      return false;
    }
    var upNews = new News({
      originalLink: url,
      spiderId: spiderId,
    });
    upNews.save();
    return true;
  });
}

//spiderKhuyenNongUpdateAll
function spiderKhuyenNongUpdateAll() {
  News.find({
    $or: [{
      title: undefined
    }, {
      title: ""
    }, {
      content: undefined
    }, {
      author: undefined
    }, {
      author: ""
    }, {
      createDate: undefined
    }, {
      createDate: ""
    }]
  }, function (err, news) {
    var page = 0;
    var lastPage = news.length;
    async.whilst(function () {
        return page < lastPage;
      },
      function (next) {
        if (news[page].title === undefined || news[page].title === "") {
          request(news[page].originalLink, function (err, res, body) {
            if (!err && res.statusCode === 200) {
              var $ = cheerio.load(body);
              async.series({
                  title: function (callback) {
                    news[page].title = $('.title_detail').text();
                    callback(null, news[page].title);
                  },
                  content: function (callback) {
                    //#the-post > div
                    let content = $('div.xcontents').html().split('src="/').join('src="www.khuyennongvn.gov.vn/');
                    //#post-ratings-2150
                    callback(null, content);
                  },
                  author: function (callback) {
                    let author = "Báo Dân Sinh";
                    news[page].author = author;
                    callback(null, news[page].author);
                  },
                  createDate: function (callback) {
                    var date = new Date();
                    var dateF = $('.date').text().split('/');
                    date.setDate(dateF[0]);
                    date.setMonth(dateF[1]);
                    date.setFullYear(dateF[2]);
                    callback(null, date);
                  },
                  updateDate: function (callback) {
                    callback(null, Date.now());
                  }
                },
                function (err, result) {
                  news[page].title = result.title;
                  news[page].content = result.content;
                  news[page].author = result.author;
                  news[page].createDate = result.createDate;
                  news[page].updateDate = result.updateDate;
                  console.log(news[page].title);
                  news[page].save(function (err) {
                    if (err) {}
                  });
                });
            } else {}
            page++;
            next();
          });
        } else {
          page++;
          next();
        }
      },
      function (err) {});
  });
}

//spiderKhuyenNongUpdatePath
function spiderKhuyenNongUpdatePath(categoryId) {
  News.find({
    categoryId: categoryId
  }, function (err, news) {
    var page = 0;
    var lastPage = news.length;
    async.whilst(function () {
        return page < lastPage;
      },
      function (next) {
        if (news[page].title === undefined || news[page].title === "") {
          request(news[page].originalLink, function (err, res, body) {
            if (!err && res.statusCode === 200) {
              var $ = cheerio.load(body);
              async.series({
                  title: function (callback) {
                    news[page].title = $('.xtext h1').text();
                    callback(null, news[page].title);
                  },
                  content: function (callback) {
                    let content = $('div.xcontents').html().split('src="/').join('src="www.khuyennongvn.gov.vn/');
                    callback(null, content);
                  },
                  author: function (callback) {
                    let author = "Báo Khuyến Nông";
                    news[page].author = author;
                    callback(null, news[page].author);
                  },
                  createDate: function (callback) {
                    callback(null, Date.now());
                  },
                  updateDate: function (callback) {
                    callback(null, Date.now());
                  }
                },
                function (err, result) {
                  news[page].title = result.title;
                  news[page].content = result.content;
                  news[page].author = result.author;
                  news[page].createDate = result.createDate;
                  news[page].updateDate = result.updateDate;
                  console.log(news[page].title);
                  console.log(news[page].createDate);
                  news[page].save(function (err) {
                    if (err) {
                      console.log('error');
                    }
                  });
                });
            } else {
              console.log('log die');
            }
            page++;
            next();
          });
        } else {
          page++;
          next();
        }
      },
      function (err) {});
  });
}

//spiderKhuyenNongUpdateUrl
function spiderKhuyenNongUpdateUrl(url) {
  News.findById({
    _id: url
  }, function (err, news) {
    if (news !== null) {
      request(news.originalLink, function (err, res, body) {
        if (!err && res.statusCode === 200) {
          var $ = cheerio.load(body);
          async.series({
              title: function (callback) {
                news.title = $('.xtext h1').text()
                callback(null, news.title);
              },
              content: function (callback) {
                let content = $('div.xcontents').html().split('src="/').join('src="www.khuyennongvn.gov.vn/');
                //#the-post > div > div.entry > div
                // let remove_review_overview = $('#main-content > div.content > article > div > div.entry > div.review-box.review-top.review-stars').html();
                callback(null, content);
              },
              contentText: function (callback) {
                let content = $('#content_detail_news').text();
                callback(null, content);
              },
              author: function (callback) {
                let author = "Báo Khuyến Nông";
                callback(null, author);
              },
              createDate: function (callback) {
                callback(null, Date.now());
              },
              updateDate: function (callback) {
                callback(null, Date.now());
              }
            },
            function (err, result) {
              news.title = result.title;
              news.content = result.content;
              news.author = result.author;
              news.createDate = Date.now();
              news.updateDate = result.updateDate;
              console.log(news.originalLink);
              checkRestrictedKey(url, result.contentText).then(res => {
                news.save(function (err) {
                  if (err) {
                    console.log('error');
                  }
                });
              });
            });
        } else {}
      });
    }
  });
}

function spiderKhuyenNongUpdateUrlVersion2(url) {
  return new Promise(function (resolve, reject) {
    return News.findById({
      _id: url
    }, function (err, upNews) {
      if (upNews !== null) {
        request(upNews.originalLink, function (err, res, body) {
          if (!err && res.statusCode === 200) {
            var $ = cheerio.load(body);
            async.series({
                title: function (callback) {
                  upNews.title = $('.xtext h1').text();
                  callback(null, upNews.title);
                },
                content: function (callback) {
                  let content = $('div.xcontents').html().split('src="/').join('src="www.khuyennongvn.gov.vn/') ;
                  callback(null, content);
                },
                contentText: function (callback) {
                  let content = $('.xcontents').text();
                  callback(null, content);
                },
                author: function (callback) {
                  upNews.author = "Báo Khuyến Nông";
                  callback(null, upNews.author);
                },
                createDate: function (callback) {
                  callback(null, Date.now());
                },
                updateDate: function (callback) {
                  callback(null, Date.now());
                }
              },
              function (err, result) {
                upNews.title = result.title;
                upNews.content = result.content;
                upNews.author = result.author;
                upNews.createDate = result.createDate;
                upNews.updateDate = result.updateDate;
                upNews.contentText = result.contentText;
                console.log(upNews.originalLink);
                checkRestrictedKey(url, result.contentText).then(res => {
                  return upNews.save(function (err) {
                    if (err) {
                      return reject({
                        'message': false
                      });
                    }
                    return resolve({
                      'message': true
                    });
                  });
                });
              });
          } else {
            return reject({
              'message': false
            });
          }
        });
      }
    });
  })
}

function getPathUpdateKhuyenNong(path, spiderId, catelogyId) {
  return new Promise(function (resolve, reject) {
    if (path === undefined) {
      return resolve(true);
    }
    var total = 0;
    var arrayNews = [];
    var orgi = path;
    SpiderModel.findById({
      _id: spiderId
    }).then(spider => {
      UrlModel.findById({
        _id: spider.urlId
      }).then(urlHost => {
        async.whilst(function () {
            return path !== undefined
          }, function (next) {
            async.series({
                gotoPage: function (callback) {
                  request(path, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                      var $ = cheerio.load(body);
                      let i = 1;
                      var length = $('.contentx .xitem').length;
                      if (length === 0) {
                        resolve(true);
                      }
                      var temp = new Promise(function (resolve, reject) {
                        $('.contentx .xitem').each(function () {
                          if (length == 0 || length == undefined) {
                            resolve(true);
                          }
                          url = urlHost.hostname + $('div.contentx > div:nth-child(' + i + ') > h2 > a').attr('href');
                          image = urlHost.hostname + $('div.contentx > div:nth-child(' + i + ') > a > img').attr('src');
                          des = $('div.contentx > div:nth-child(' + i + ') > span').text();
                          if (image === undefined) {
                            image = null;
                          }
                          var news = new News({
                            originalLink: url,
                            spiderId: spiderId,
                            categoryId: catelogyId,
                            image: image,
                            description: des,
                            active: false,
                            updateDate: Date.now()
                          });
                          News.findOne({
                            originalLink: news.originalLink
                          }, function (err, New) {
                            if (New === null) {
                              arrayNews.push(news._id);
                              news.save();
                            } else {
                              New.updateDate = Date.now();
                              arrayNews.push(New._id);
                              New.save();
                            }
                            total++;
                            if (total === 200) {
                              resolve(true);
                            }
                          });
                          i++;
                          if (i == length) {
                            resolve(true);
                          }
                        });
                      });
                      temp.then(function (res) {
                        var gotoPage = urlHost.hostname + $('#dnn_ctr530_Main_UserNewsCategory__UserPagger_nextx').attr('href');
                        if (gotoPage === undefined) {
                          return resolve({
                            'total': total,
                            'listNewsId': arrayNews,
                            'status': true
                          });
                        }
                        if (total >= 10) {
                          return resolve({
                            'total': total,
                            'listNewsId': arrayNews,
                            'status': true
                          });
                        }
                        callback(null, gotoPage);
                      })
                    } else {
                      return reject(false);
                    }
                  });
                }
              },
              function (err, result) {
                path = result.gotoPage;
                next();
              });
          },
          function (err) {
            return resolve(true);
          })
      });
    });

  });
}
