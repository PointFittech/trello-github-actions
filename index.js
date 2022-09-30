"use strict";
exports.__esModule = true;
var core = require("@actions/core");
var github = require("@actions/github");
try {
    var apiKey = process.env['TRELLO_API_KEY'];
    var apiToken = process.env['TRELLO_API_TOKEN'];
    var boardId = process.env['TRELLO_BOARD_ID'];
    var action = core.getInput('trello-action');
    switch (action) {
        case 'create_card_when_issue_opened':
            createCardWhenIssueOpen(apiKey, apiToken, boardId);
            break;
        case 'move_card_when_pull_request_opened':
            moveCardWhenPullRequestOpen(apiKey, apiToken, boardId);
            break;
        case 'move_card_when_pull_request_closed':
            moveCardWhenPullRequestClose(apiKey, apiToken, boardId);
            break;
        case 'move_card_when_issue_closed':
            moveCardWhenIssueClose(apiKey, apiToken);
            break;
    }
}
catch (error) {
    core.setFailed(error.message);
}
function createCardWhenIssueOpen(apiKey, apiToken, boardId) {
    var listId = process.env['TRELLO_LIST_ID'];
    var issue = github.context.payload.issue;
    if (!issue)
        return;
    var number = issue.number;
    var title = issue.title;
    var description = issue.body;
    var url = issue.html_url;
    var assignees = issue.assignees.map(function (assignee) { return assignee.login; });
    var issueLabelNames = issue.labels.map(function (label) { return label.name; });
    getLabelsOfBoard(apiKey, apiToken, boardId).then(function (response) {
        var trelloLabels = response;
        var trelloLabelIds = [];
        issueLabelNames.forEach(function (issueLabelName) {
            trelloLabels.forEach(function (trelloLabel) {
                if (trelloLabel.name == issueLabelName) {
                    trelloLabelIds.push(trelloLabel.id);
                }
            });
        });
        getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
            var members = response;
            var memberIds = [];
            assignees.forEach(function (assignee) {
                members.forEach(function (member) {
                    if (member.username == assignee) {
                        memberIds.push(member.id);
                    }
                });
            });
            var cardParams = {
                number: number,
                title: title,
                description: description,
                url: url,
                memberIds: memberIds.join(),
                labelIds: trelloLabelIds.join()
            };
            createCard(apiKey, apiToken, listId, cardParams).then(function (response) {
                console.dir(response);
            });
        });
    });
}
function moveCardWhenPullRequestOpen(apiKey, apiToken, boardId) {
    var _a, _b;
    var departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
    var destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
    var pullRequest = github.context.payload.pull_request;
    if (!pullRequest)
        return;
    var issue_number = (_b = (_a = pullRequest.body) === null || _a === void 0 ? void 0 : _a.match(/#[0-9]+/)) === null || _b === void 0 ? void 0 : _b[0].slice(1);
    var url = pullRequest.html_url;
    var reviewers = pullRequest.requested_reviewers.map(function (reviewer) { return reviewer.login; });
    getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
        var members = response;
        var additionalMemberIds = [];
        reviewers.forEach(function (reviewer) {
            members.forEach(function (member) {
                if (member.username == reviewer) {
                    additionalMemberIds.push(member.id);
                }
            });
        });
        getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
            var cards = response;
            var cardId;
            var existingMemberIds = [];
            cards.some(function (card) {
                var card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
                if (card_issue_number == issue_number) {
                    cardId = card.id;
                    existingMemberIds = card.idMembers;
                    return true;
                }
            });
            var cardParams = {
                destinationListId: destinationListId,
                memberIds: existingMemberIds.concat(additionalMemberIds).join()
            };
            if (cardId) {
                putCard(apiKey, apiToken, cardId, cardParams).then(function (response) {
                    addUrlSourceToCard(apiKey, apiToken, cardId, url);
                });
            }
            else {
                core.setFailed('Card not found.');
            }
        });
    });
}
function moveCardWhenPullRequestClose(apiKey, apiToken, boardId) {
    var _a;
    var departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
    var destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
    var pullRequest = github.context.payload.pull_request;
    if (!pullRequest)
        return;
    var issue_numbers = (_a = pullRequest.body) === null || _a === void 0 ? void 0 : _a.match(/#[0-9]+/);
    if (!issue_numbers || issue_numbers.length === 0)
        return;
    var issue_number = issue_numbers[0].slice(1);
    var reviewers = pullRequest.requested_reviewers.map(function (reviewer) { return reviewer.login; });
    getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
        var members = response;
        var additionalMemberIds = [];
        reviewers.forEach(function (reviewer) {
            members.forEach(function (member) {
                if (member.username == reviewer) {
                    additionalMemberIds.push(member.id);
                }
            });
        });
        getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
            var cards = response;
            var cardId;
            var existingMemberIds = [];
            cards.some(function (card) {
                var card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
                if (card_issue_number == issue_number) {
                    cardId = card.id;
                    existingMemberIds = card.idMembers;
                    return true;
                }
            });
            var cardParams = {
                destinationListId: destinationListId,
                memberIds: existingMemberIds.concat(additionalMemberIds).join()
            };
            if (cardId) {
                putCard(apiKey, apiToken, cardId, cardParams);
            }
            else {
                core.setFailed('Card not found.');
            }
        });
    });
}
function moveCardWhenIssueClose(apiKey, apiToken) {
    var departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
    var destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
    var issue = github.context.payload.issue;
    if (!issue)
        return;
    var issue_number = issue.number;
    getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
        var cards = response;
        var cardId;
        var existingMemberIds = [];
        cards.some(function (card) {
            var card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
            if (card_issue_number == issue_number) {
                cardId = card.id;
                existingMemberIds = card.idMembers;
                return true;
            }
        });
        var cardParams = {
            destinationListId: destinationListId,
            memberIds: existingMemberIds.join()
        };
        if (cardId) {
            putCard(apiKey, apiToken, cardId, cardParams);
        }
        else {
            core.setFailed('Card not found.');
        }
    });
}
function getLabelsOfBoard(apiKey, apiToken, boardId) {
    return new Promise(function (resolve, reject) {
        fetch("https://api.trello.com/1/boards/" + boardId + "/labels?key=" + apiKey + "&token=" + apiToken)
            .then(function (body) {
            resolve(body.json());
        })["catch"](function (error) {
            reject(error);
        });
    });
}
function getMembersOfBoard(apiKey, apiToken, boardId) {
    return new Promise(function (resolve, reject) {
        fetch("https://api.trello.com/1/boards/" + boardId + "/members?key=" + apiKey + "&token=" + apiToken)
            .then(function (body) {
            resolve(body.json());
        })["catch"](function (error) {
            reject(error);
        });
    });
}
function getCardsOfList(apiKey, apiToken, listId) {
    return new Promise(function (resolve, reject) {
        fetch("https://api.trello.com/1/lists/" + listId + "/cards?key=" + apiKey + "&token=" + apiToken)
            .then(function (body) {
            resolve(body.json());
        })["catch"](function (error) {
            reject(error);
        });
    });
}
function createCard(apiKey, apiToken, listId, params) {
    var options = {
        method: 'POST',
        url: 'https://api.trello.com/1/cards',
        form: {
            idList: listId,
            keepFromSource: 'all',
            key: apiKey,
            token: apiToken,
            name: "[#" + params.number + "] " + params.title,
            desc: params.description,
            urlSource: params.url,
            idMembers: params.memberIds,
            idLabels: params.labelIds
        },
        json: true
    };
    return new Promise(function (resolve, reject) {
        fetch(options.url, { method: 'POST', body: JSON.stringify(options.form) })
            .then(function (body) {
            resolve(body);
        })["catch"](function (error) {
            reject(error);
        });
    });
}
function putCard(apiKey, apiToken, cardId, params) {
    var options = {
        method: 'PUT',
        url: "https://api.trello.com/1/cards/" + cardId + "?key=" + apiKey + "&token=" + apiToken,
        form: {
            idList: params.destinationListId,
            idMembers: params.memberIds
        }
    };
    return new Promise(function (resolve, reject) {
        fetch(options.url, { method: 'POST', body: JSON.stringify(options.form) })
            .then(function (body) {
            resolve(body.json());
        })["catch"](function (error) {
            reject(error);
        });
    });
}
function addUrlSourceToCard(apiKey, apiToken, cardId, url) {
    var options = {
        method: 'POST',
        url: "https://api.trello.com/1/cards/" + cardId + "/attachments?key=" + apiKey + "&token=" + apiToken,
        form: {
            url: url
        }
    };
    return new Promise(function (resolve, reject) {
        fetch(options.url, { method: 'POST', body: JSON.stringify(options.form) })
            .then(function (body) {
            resolve(body.json());
        })["catch"](function (error) {
            reject(error);
        });
    });
}
