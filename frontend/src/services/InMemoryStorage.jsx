const storage = {};

const InMemoryStorage = {
    getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
    },
    setItem(key, value) {
        storage[key] = value;
    },
    removeItem(key) {
        delete storage[key];
    },
    clear() {
        for (const key in storage) {
            if (Object.prototype.hasOwnProperty.call(storage, key)) {
                delete storage[key];
            }
        }
    }
};

export default InMemoryStorage;
