const userStates = new Map();


function setState(userId, data) {
    userStates.set(userId, data)
}


function getState(userId) {
    return userStates.get(userId) || {};
}

function clearState(userId) {
    userStates.delete(userId);
}


module.exports = {
    setState,
    getState,
    clearState
};


