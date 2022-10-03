import * as core from '@actions/core';
import * as github from '@actions/github';
import fetch from 'node-fetch';
try {
	const apiKey = process.env['TRELLO_API_KEY'];
	const apiToken = process.env['TRELLO_API_TOKEN'];
	const boardId = process.env['TRELLO_BOARD_ID'];
	const action = core.getInput('trello-action');

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
} catch (error) {
	core.setFailed(error.message);
}

function createCardWhenIssueOpen(apiKey, apiToken, boardId) {
	const listId = process.env['TRELLO_LIST_ID'];
	const issue = github.context.payload.issue;
	if (!issue) return;
	const number = issue.number;
	const title = issue.title;
	const description = issue.body;
	const url = issue.html_url;
	const assignees = issue.assignees.map((assignee) => assignee.login);
	const issueLabelNames = issue.labels.map((label) => label.name);

	getLabelsOfBoard(apiKey, apiToken, boardId).then(function (response) {
		const trelloLabels = response;
		const trelloLabelIds: any[] = [];
		issueLabelNames.forEach(function (issueLabelName) {
			trelloLabels.forEach(function (trelloLabel: any) {
				if (trelloLabel.name == issueLabelName) {
					trelloLabelIds.push(trelloLabel.id);
				}
			});
		});

		getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
			const members = response;
			const memberIds: any[] = [];
			assignees.forEach(function (assignee) {
				members.forEach(function (member: any) {
					if (member.username == assignee) {
						memberIds.push(member.id);
					}
				});
			});
			const cardParams = {
				number: number,
				title: title,
				description: description,
				url: url,
				memberIds: memberIds.join(),
				labelIds: trelloLabelIds.join(),
			};

			createCard(apiKey, apiToken, listId, cardParams).then(function (
				response
			) {
				console.dir(response);
			});
		});
	});
}

function moveCardWhenPullRequestOpen(apiKey, apiToken, boardId) {
	const departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
	const destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
	const pullRequest = github.context.payload.pull_request;
	if (!pullRequest) return;
	const issue_number = pullRequest.body?.match(/#[0-9]+/)?.[0].slice(1);
	const url = pullRequest.html_url;
	const reviewers = pullRequest.requested_reviewers.map(
		(reviewer) => reviewer.login
	);

	getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
		const members = response;
		const additionalMemberIds: string[] = [];
		reviewers.forEach(function (reviewer) {
			members.forEach(function (member) {
				if (member.username == reviewer) {
					additionalMemberIds.push(member.id);
				}
			});
		});

		getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
			const cards = response;
			let cardId;
			let existingMemberIds: string[] = [];
			cards.some(function (card) {
				const card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
				if (card_issue_number == issue_number) {
					cardId = card.id;
					existingMemberIds = card.idMembers;
					return true;
				}
			});
			const cardParams = {
				destinationListId: destinationListId,
				memberIds: existingMemberIds.concat(additionalMemberIds).join(),
			};

			if (cardId) {
				putCard(apiKey, apiToken, cardId, cardParams).then(function (response) {
					addUrlSourceToCard(apiKey, apiToken, cardId, url);
				});
			} else {
				core.setFailed('Card not found.');
			}
		});
	});
}

function moveCardWhenPullRequestClose(apiKey, apiToken, boardId) {
	const departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
	const destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
	const pullRequest = github.context.payload.pull_request;
	if (!pullRequest) return;

	const issue_numbers = pullRequest.body?.match(/#[0-9]+/);
	if (!issue_numbers || issue_numbers.length === 0) return;

	const issue_number = issue_numbers[0].slice(1);
	const reviewers = pullRequest.requested_reviewers.map(
		(reviewer) => reviewer.login
	);

	getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
		const members = response;
		const additionalMemberIds: string[] = [];
		reviewers.forEach(function (reviewer) {
			members.forEach(function (member: any) {
				if (member.username == reviewer) {
					additionalMemberIds.push(member.id);
				}
			});
		});

		getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
			const cards = response;
			let cardId;
			let existingMemberIds: string[] = [];
			cards.some(function (card) {
				const card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
				if (card_issue_number == issue_number) {
					cardId = card.id;
					existingMemberIds = card.idMembers;
					return true;
				}
			});
			const cardParams = {
				destinationListId: destinationListId,
				memberIds: existingMemberIds.concat(additionalMemberIds).join(),
			};

			if (cardId) {
				putCard(apiKey, apiToken, cardId, cardParams);
			} else {
				core.setFailed('Card not found.');
			}
		});
	});
}

function moveCardWhenIssueClose(apiKey, apiToken) {
	const departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
	const destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
	const issue = github.context.payload.issue;
	if (!issue) return;
	const issue_number = issue.number;

	getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
		const cards = response;
		let cardId;
		let existingMemberIds: string[] = [];
		cards.some(function (card) {
			const card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
			if (card_issue_number == issue_number) {
				cardId = card.id;
				existingMemberIds = card.idMembers;
				return true;
			}
		});
		const cardParams = {
			destinationListId: destinationListId,
			memberIds: existingMemberIds.join(),
		};

		if (cardId) {
			putCard(apiKey, apiToken, cardId, cardParams);
		} else {
			core.setFailed('Card not found.');
		}
	});
}

function getLabelsOfBoard(apiKey, apiToken, boardId): Promise<any> {
	return new Promise(function (resolve, reject) {
		fetch(
			`https://api.trello.com/1/boards/${boardId}/labels?key=${apiKey}&token=${apiToken}`
		)
			.then(function (body) {
				resolve(body.json());
			})
			.catch(function (error) {
				reject(error);
			});
	});
}

function getMembersOfBoard(apiKey, apiToken, boardId): Promise<any> {
	return new Promise(function (resolve, reject) {
		fetch(
			`https://api.trello.com/1/boards/${boardId}/members?key=${apiKey}&token=${apiToken}`
		)
			.then(function (body) {
				resolve(body.json());
			})
			.catch(function (error) {
				reject(error);
			});
	});
}

function getCardsOfList(apiKey, apiToken, listId): Promise<any> {
	return new Promise(function (resolve, reject) {
		fetch(
			`https://api.trello.com/1/lists/${listId}/cards?key=${apiKey}&token=${apiToken}`
		)
			.then(function (body) {
				resolve(body.json());
			})
			.catch(function (error) {
				reject(error);
			});
	});
}

export function createCard(apiKey, apiToken, listId, params) {
	const options = {
		method: 'POST',
		url: 'https://api.trello.com/1/cards',
		form: {
			idList: listId,
			keepFromSource: 'all',
			key: apiKey,
			token: apiToken,
			name: `[#${params.number}] ${params.title}`,
			desc: params.description,
			urlSource: params.url,
			idMembers: params.memberIds,
			idLabels: params.labelIds,
		},
		json: true,
	};
	return new Promise(function (resolve, reject) {
		fetch(options.url, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options.form),
		})
			.then(function (body) {
				resolve(body);
			})
			.catch(function (error) {
				reject(error);
			});
	});
}

function putCard(apiKey, apiToken, cardId, params) {
	const options = {
		method: 'PUT',
		url: `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}`,
		form: {
			idList: params.destinationListId,
			idMembers: params.memberIds,
		},
	};
	return new Promise(function (resolve, reject) {
		fetch(options.url, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options.form),
		})
			.then(function (body) {
				resolve(body.json());
			})
			.catch(function (error) {
				reject(error);
			});
	});
}

function addUrlSourceToCard(apiKey, apiToken, cardId, url) {
	const options = {
		method: 'POST',
		url: `https://api.trello.com/1/cards/${cardId}/attachments?key=${apiKey}&token=${apiToken}`,
		form: {
			url: url,
		},
	};
	return new Promise(function (resolve, reject) {
		fetch(options.url, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options.form),
		})
			.then(function (body) {
				resolve(body.json());
			})
			.catch(function (error) {
				reject(error);
			});
	});
}
