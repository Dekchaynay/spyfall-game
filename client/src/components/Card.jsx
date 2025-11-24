import React from 'react';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '' }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-slate-700/50 ${className}`}
        >
            {children}
        </motion.div>
    );
};
