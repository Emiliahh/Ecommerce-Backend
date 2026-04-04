import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node'; // Check lại doc nếu import là "import PayOS from..." nhé
import { EnvConfig } from 'src/env.validation';

// Định nghĩa token để inject ở các service khác
export const PAYOS_INSTANCE = 'PAYOS_INSTANCE';

export const PayosProvider: Provider = {
    provide: PAYOS_INSTANCE,
    useFactory: (configService: ConfigService<EnvConfig>) => {
        const clientId = configService.get<string>('PAYOS_CLIENT_ID');
        const apiKey = configService.get<string>('PAYOS_API_KEY');
        const checksumKey = configService.get<string>('PAYOS_CHECKSUM_KEY');


        // Khởi tạo instance của PayOS
        return new PayOS({
            clientId,
            apiKey,
            checksumKey,
        });
    },
    inject: [ConfigService],
};