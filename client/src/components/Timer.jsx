import React, { useEffect, useState } from 'react';

export const Timer = ({ initialTime, onTick }) => {
    const [timeLeft, setTimeLeft] = useState(initialTime);

    const onTickRef = React.useRef(onTick);

    useEffect(() => {
        onTickRef.current = onTick;
    }, [onTick]);

    useEffect(() => {
        setTimeLeft(initialTime);
        const endTime = Date.now() + initialTime * 1000;

        const intervalId = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));

            setTimeLeft(remaining);
            if (onTickRef.current) onTickRef.current(remaining);

            if (remaining <= 0) {
                clearInterval(intervalId);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [initialTime]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <div className={`text-4xl font-bold font-mono mb-4 ${timeLeft <= 60 ? 'text-red-500 animate-pulse' : 'text-rose-500'}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
    );
};
