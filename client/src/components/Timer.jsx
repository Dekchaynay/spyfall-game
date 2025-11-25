import React, { useEffect, useState } from 'react';

export const Timer = ({ initialTime, onTick }) => {
    const [timeLeft, setTimeLeft] = useState(initialTime);

    useEffect(() => {
        setTimeLeft(initialTime);
    }, [initialTime]);

    useEffect(() => {
        if (timeLeft <= 0) return;

        const intervalId = setInterval(() => {
            setTimeLeft((prev) => {
                const newTime = prev - 1;
                if (onTick) onTick(newTime);
                return newTime;
            });
        }, 1000);

        return () => clearInterval(intervalId);
    }, [timeLeft, onTick]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <div className={`text-4xl font-bold font-mono mb-4 ${timeLeft <= 60 ? 'text-red-500 animate-pulse' : 'text-rose-500'}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
    );
};
