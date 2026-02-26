import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SesService } from '../aws/ses.service';
import mjml2html = require('mjml');
import * as fs from 'fs';
import * as path from 'path';

export interface SendEmailOptions {
  to: string | string[];
  templateName: string;
  locale?: string;
  variables: Record<string, string>;
  replyTo?: string;
}

interface CompiledTemplate {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly templatesDir: string;
  private readonly frontendUrl: string;
  private readonly defaultLocale = 'pt-BR';

  constructor(
    private readonly sesService: SesService,
    private readonly configService: ConfigService,
  ) {
    this.templatesDir = path.resolve(__dirname, '../../templates/email');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  isAvailable(): boolean {
    return this.sesService.isAvailable();
  }

  async sendEmail(options: SendEmailOptions): Promise<string | null> {
    const locale = options.locale || this.defaultLocale;

    const compiled = this.compileTemplate(options.templateName, locale, options.variables);

    return this.sesService.sendEmail({
      to: options.to,
      subject: compiled.subject,
      htmlBody: compiled.html,
      textBody: compiled.text,
      replyTo: options.replyTo,
    });
  }

  compileTemplate(
    templateName: string,
    locale: string,
    variables: Record<string, string>,
  ): CompiledTemplate {
    const mjmlSource = this.loadTemplate(templateName, locale);

    const allVariables: Record<string, string> = {
      frontendUrl: this.frontendUrl,
      year: new Date().getFullYear().toString(),
      ...variables,
    };

    const resolvedMjml = this.interpolateVariables(mjmlSource, allVariables);

    const { html, errors } = mjml2html(resolvedMjml, {
      validationLevel: 'soft',
      minify: true,
    });

    if (errors.length > 0) {
      this.logger.warn(
        `MJML compilation warnings for ${templateName}/${locale}: ${errors.map((e) => e.formattedMessage).join('; ')}`,
      );
    }

    const subject = this.extractSubject(mjmlSource, allVariables);
    const text = this.generatePlainText(html);

    return { subject, html, text };
  }

  private loadTemplate(templateName: string, locale: string): string {
    const primaryPath = path.join(this.templatesDir, templateName, `${locale}.mjml`);
    const fallbackPath = path.join(this.templatesDir, templateName, `${this.defaultLocale}.mjml`);

    if (fs.existsSync(primaryPath)) {
      return fs.readFileSync(primaryPath, 'utf-8');
    }

    if (locale !== this.defaultLocale && fs.existsSync(fallbackPath)) {
      this.logger.warn(
        `Template ${templateName}/${locale}.mjml not found, falling back to ${this.defaultLocale}`,
      );
      return fs.readFileSync(fallbackPath, 'utf-8');
    }

    throw new Error(`Email template not found: ${templateName}/${locale}.mjml`);
  }

  private interpolateVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, this.escapeHtml(value));
    }
    return result;
  }

  private extractSubject(mjmlSource: string, variables: Record<string, string>): string {
    const match = mjmlSource.match(/<!--\s*subject:\s*(.*?)\s*-->/i);
    if (!match) {
      return 'Navia';
    }
    let subject = match[1];
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(placeholder, value);
    }
    return subject;
  }

  private generatePlainText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
