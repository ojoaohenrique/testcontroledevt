// Configuration loader for GML Controle de Viaturas
// This file loads configuration from environment or uses defaults

(function () {
    'use strict';

    // Configuration object
    const config = {
        // Supabase configuration
        // In production, these should be set via environment variables
        // For local development, you can set them here or use a local .env file
        SUPABASE_URL: window.ENV_SUPABASE_URL || '',
        SUPABASE_ANON_KEY: window.ENV_SUPABASE_ANON_KEY || '',

        // API Base URL
        // In production, this is the same domain (relative path)
        // For local development, use http://localhost:5000/api
        API_BASE_URL: window.ENV_API_BASE_URL || '/api',

        // App version
        APP_VERSION: '1.0.5',

        // Environment
        IS_PRODUCTION: window.location.hostname !== 'localhost' &&
            !window.location.hostname.includes('127.0.0.1'),
    };

    // Validate configuration
    function validateConfig() {
        const missing = [];
        if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
        if (!config.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');

        if (missing.length > 0) {
            console.warn('Missing configuration:', missing.join(', '));
            console.warn('Please set window.ENV_SUPABASE_URL and window.ENV_SUPABASE_ANON_KEY');
        }

        return missing.length === 0;
    }

    // Initialize configuration
    function init() {
        // A configuracao NAO e mais lida do localStorage: isso permitia que um
        // script malicioso trocasse o endereco do banco de forma persistente.
        try { localStorage.removeItem('gml_config'); } catch (e) { /* ignora */ }

        // Expose config globally
        window.APP_CONFIG = config;
        window.validateAppConfig = validateConfig;

        // Set legacy variables for backward compatibility
        window.SUPABASE_URL = config.SUPABASE_URL;
        window.SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
        window.API_BASE_URL = config.API_BASE_URL;

        console.log('App config loaded. Environment:', config.IS_PRODUCTION ? 'production' : 'development');
    }

    // Run initialization
    init();
})();
