"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.handler = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const serverless_express_1 = __importDefault(require("@codegenie/serverless-express"));
const path_1 = __importDefault(require("path"));
const users_1 = __importDefault(require("./routes/users"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const teams_1 = __importDefault(require("./routes/teams"));
const games_1 = __importDefault(require("./routes/games"));
const meals_1 = __importDefault(require("./routes/meals"));
const app = (0, express_1.default)();
exports.app = app;
const BASE_PATH = process.env.BASE_PATH || '/widgets/clubhouse';
// Middleware
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Health check endpoint
app.get(`${BASE_PATH}/health`, async (req, res) => {
    res.json({
        status: 'ok',
        message: 'ClubhouseWidget Lambda is running',
        timestamp: new Date().toISOString(),
        basePath: BASE_PATH,
    });
});
// API Routes
app.use(`${BASE_PATH}/api/users`, users_1.default);
app.use(`${BASE_PATH}/api/tasks`, tasks_1.default);
app.use(`${BASE_PATH}/api/inventory`, inventory_1.default);
app.use(`${BASE_PATH}/api/teams`, teams_1.default);
app.use(`${BASE_PATH}/api/games`, games_1.default);
app.use(`${BASE_PATH}/api/meals`, meals_1.default);
// Root API endpoint
app.get(`${BASE_PATH}/api`, (req, res) => {
    res.json({
        message: 'ClubhouseWidget API',
        version: '1.0.0',
        endpoints: {
            health: `${BASE_PATH}/health`,
            users: `${BASE_PATH}/api/users`,
            tasks: `${BASE_PATH}/api/tasks`,
            inventory: `${BASE_PATH}/api/inventory`,
            teams: `${BASE_PATH}/api/teams`,
            games: `${BASE_PATH}/api/games`,
            meals: `${BASE_PATH}/api/meals`,
        },
    });
});
// Serve static files for SPA
app.use(BASE_PATH, express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
// SPA fallback - serve index.html for all non-API routes
app.get(`${BASE_PATH}/*`, (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.includes('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
// Handle root path
app.get(BASE_PATH, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});
// Lambda handler
exports.handler = (0, serverless_express_1.default)({ app });
// For local development
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 ClubhouseWidget Lambda running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}${BASE_PATH}/health`);
        console.log(`📋 API: http://localhost:${PORT}${BASE_PATH}/api`);
    });
}
//# sourceMappingURL=index.js.map